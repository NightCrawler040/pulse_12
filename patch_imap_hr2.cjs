const fs = require('fs');

let code = fs.readFileSync('server/services/imapService.js', 'utf8');

// Inject the HR logic properly right after finding the user
if (!code.includes('HR JML Processing')) {
  // Let's find the place using a regex
  code = code.replace(/if \(\!pulseUser\) \{\s+console\.log\(`\[IMAP\].*?\n\s+return;\s+\}/,
    `$&
      // ---- HR JML Processing (PDF) ----
      let hrOrderData = null;
      let hrPdfAttachment = null;

      if (parsedMail.attachments && parsedMail.attachments.length > 0) {
        for (const att of parsedMail.attachments) {
          if (att.contentType === 'application/pdf' || (att.filename && att.filename.toLowerCase().endsWith('.pdf'))) {
            try {
              const parsedHr = await parseHrOrderPDF(att.content);
              if (parsedHr) {
                hrOrderData = parsedHr;
                hrPdfAttachment = att;
                break;
              }
            } catch (e) {
              console.error('[IMAP] Ошибка парсинга PDF приказа:', e);
            }
          }
        }
      }

      if (hrOrderData) {
        // Save PDF to disk
        if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        const safeFilename = \`hr_order_\${Date.now()}_\${hrPdfAttachment.filename.replace(/[^a-zA-Z0-9.-]/g, '_')}\`;
        const filePath = path.join(UPLOADS_DIR, safeFilename);
        fs.writeFileSync(filePath, hrPdfAttachment.content);
        
        hrOrderData.pdfUrl = \`/api/uploads/\${safeFilename}\`;

        // Load targeted Workspace and Group from hrSettings
        const hrSettings = currentDbData.hrSettings || { workspaceId: 'WS-1', groupId: null };
        const targetWsId = hrSettings.workspaceId;

        // Push to DB
        hrOrderData.id = crypto.randomUUID();
        hrOrderData.createdAt = new Date().toISOString();
        hrOrderData.statusKaspersky = 'pending';
        hrOrderData.statusDlpDg = 'pending';
        hrOrderData.statusStaffcop = 'pending';
        hrOrderData.statusCisco = 'pending';
        hrOrderData.statusAd = 'pending';
        hrOrderData.workspaceId = targetWsId;

        if (!currentDbData.hr_orders) currentDbData.hr_orders = [];
        currentDbData.hr_orders.push(hrOrderData);
        await saveCollection('hr_orders', currentDbData.hr_orders);

        console.log(\`[IMAP] Создан новый HR Приказ для сотрудника \${hrOrderData.employeeName}\`);

        // Send websocket notification selectively
        if (hrSettings.groupId) {
          // Send to specific group only
          const group = currentDbData.groups?.find(g => g.id === hrSettings.groupId);
          if (group) {
            group.members.forEach(memberId => {
              const notifId = crypto.randomUUID();
              const notif = {
                id: notifId,
                userId: memberId,
                type: 'hr_order',
                title: 'Новый HR Приказ (JML)',
                message: \`Получен приказ: \${hrOrderData.orderType} (\${hrOrderData.employeeName})\`,
                createdAt: new Date().toISOString(),
                read: false,
                workspaceId: targetWsId
              };
              currentDbData.notifications.push(notif);
              currentBroadcast('data-updated', { notifications: currentDbData.notifications }, memberId);
            });
            saveCollection('notifications', currentDbData.notifications);
          }
        } else {
          // Broadcast to everyone in the workspace
          currentBroadcast('hr_orders_update');
          // Also create notification
          const wsUsers = currentDbData.users.filter(u => u.workspaceIds && u.workspaceIds.includes(targetWsId));
          wsUsers.forEach(u => {
            const notifId = crypto.randomUUID();
            const notif = {
              id: notifId,
              userId: u.id,
              type: 'hr_order',
              title: 'Новый HR Приказ (JML)',
              message: \`Получен приказ: \${hrOrderData.orderType} (\${hrOrderData.employeeName})\`,
              createdAt: new Date().toISOString(),
              read: false,
              workspaceId: targetWsId
            };
            currentDbData.notifications.push(notif);
          });
          saveCollection('notifications', currentDbData.notifications);
          currentBroadcast('data-updated', { notifications: currentDbData.notifications });
        }

        return; // Don't process as normal Task/Finding
      }
`);
}

// Add FortiGate Loop protection (Ignore Re: and Fwd:)
if (!code.includes('if (cleanSubj.toLowerCase().startsWith(')) {
  code = code.replace(/const cleanSubj = cleanSubject\(parsedMail\.subject\);/,
    `const cleanSubj = cleanSubject(parsedMail.subject);
      
      // Prevent loop protection: Ignore replies or forwards if configured
      if (cleanSubj.toLowerCase().startsWith('re:') || cleanSubj.toLowerCase().startsWith('fwd:')) {
        console.log('[IMAP] Пропускаем ответное письмо во избежание почтовой петли.');
        return;
      }`);
}

fs.writeFileSync('server/services/imapService.js', code);
