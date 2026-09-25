const fs = require('fs');

let code = fs.readFileSync('server/services/imapService.js', 'utf8');

// Add import
if (!code.includes('parseHrOrderPDF')) {
  code = code.replace(/import sanitizeHtml from 'sanitize-html';/, 
    "import sanitizeHtml from 'sanitize-html';\nimport { parseHrOrderPDF } from './hrOrderParser.js';");
}

// Inject logic after user check
const hook = "      if (!pulseUser) {\n        console.log(`[IMAP] ????? ??? ?' ${senderEmail}: ?>???'>? ? ??? ? + Pulse (%' ?' ??).`);\n        return;\n      }";

const hrLogic = `
      // ---- HR JML Processing (PDF) ----
      let hrOrderData = null;
      let hrPdfAttachment = null;

      if (parsedMail.attachments && parsedMail.attachments.length > 0) {
        for (const att of parsedMail.attachments) {
          if (att.contentType === 'application/pdf' || (att.filename && att.filename.toLowerCase().endsWith('.pdf'))) {
            try {
              const parsed = await parseHrOrderPDF(att.content);
              if (parsed) {
                hrOrderData = parsed;
                hrPdfAttachment = att;
                break;
              }
            } catch(e) {
              console.error('[IMAP] Failed to parse PDF for HR:', e);
            }
          }
        }
      }

      if (hrOrderData) {
        // We found an HR Order!
        console.log(\`[IMAP] Recognized HR Order: \${hrOrderData.type} for \${hrOrderData.fullName}\`);
        
        // Target workspace from global settings
        const hrSettings = currentDbData.hrSettings || {};
        // fallback to WS-1
        const targetWorkspaceId = hrSettings.workspaceId || 'WS-1';
        
        // Save PDF to disk
        let pdfUrl = '';
        if (hrPdfAttachment) {
          const safeName = \`\${Date.now()}_\${hrPdfAttachment.filename}\`;
          const filePath = path.join(UPLOADS_DIR, safeName);
          if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
          fs.writeFileSync(filePath, hrPdfAttachment.content);
          pdfUrl = \`/uploads/\${safeName}\`;
        }
        
        const newOrder = {
          id: \`hro-\${Date.now()}\`,
          workspaceId: targetWorkspaceId,
          type: hrOrderData.type,
          fullName: hrOrderData.fullName,
          date: hrOrderData.date || new Date().toISOString().split('T')[0],
          oldPosition: hrOrderData.oldPosition || hrOrderData.department || '',
          newPosition: hrOrderData.newPosition || '',
          period: hrOrderData.period || '',
          pcName: '',
          kaspersky: hrOrderData.type === 'Расторжение' || hrOrderData.type === 'Декрет' ? 'Ожидает удаления' : 'Ожидает установки',
          dlp: hrOrderData.type === 'Расторжение' || hrOrderData.type === 'Декрет' ? 'Ожидает удаления' : 'Ожидает установки',
          staffcop: hrOrderData.type === 'Расторжение' || hrOrderData.type === 'Декрет' ? 'Ожидает удаления' : 'Ожидает установки',
          cisco: hrOrderData.type === 'Расторжение' || hrOrderData.type === 'Декрет' ? 'Отключить' : 'Настроить',
          pdfUrl: pdfUrl,
          createdAt: new Date().toISOString()
        };
        
        if (!currentDbData.hr_orders) currentDbData.hr_orders = [];
        currentDbData.hr_orders.unshift(newOrder);
        
        // Save processed email
        if (messageId) {
          if (!currentDbData.processedEmails) currentDbData.processedEmails = [];
          currentDbData.processedEmails.push(messageId);
          if (currentDbData.processedEmails.length > 1000) currentDbData.processedEmails.shift();
        }

        // Notify group if configured
        if (hrSettings.assignedGroupId) {
          const group = currentDbData.groups?.find(g => g.id === hrSettings.assignedGroupId);
          if (group && group.memberIds) {
            if (!currentDbData.notifications) currentDbData.notifications = [];
            group.memberIds.forEach(memberId => {
              currentDbData.notifications.unshift({
                id: \`notif-\${Date.now()}-\${Math.random().toString(36).substr(2, 4)}\`,
                userId: memberId,
                workspaceId: targetWorkspaceId,
                title: \`Новый HR Приказ: \${hrOrderData.type}\`,
                message: \`ФИО: \${hrOrderData.fullName}\`,
                type: 'general',
                createdAt: new Date().toISOString(),
                read: false
              });
            });
          }
        }
        
        // Sync to DB and Websocket
        // Note: we can't cleanly import saveCollection here if it's not exported properly, but imapService has currentBroadcast.
        // Wait, imapService calls \`await saveCollection('hr_orders', currentDbData.hr_orders);\`
        // Let's add that export to store or just use saveCollection from store! 
        // Wait, imapService has its own saveCollection? Let's check.
`;

const replaceWith = hook + '\n' + hrLogic + `
        // we can't easily await saveCollection because it's not imported. 
        // But wait, \`await saveCollection('tasks', currentDbData.tasks);\` exists in imapService! 
        // We can just use it!
        await saveCollection('hr_orders', currentDbData.hr_orders);
        await saveCollection('processedEmails', currentDbData.processedEmails);
        if (currentDbData.notifications) await saveCollection('notifications', currentDbData.notifications);
        
        if (currentBroadcast) {
          currentBroadcast('tasks'); // forces re-sync
        }
        return; // done processing
      }
      // ---- End HR Processing ----
`;

code = code.replace(hook, replaceWith);
fs.writeFileSync('server/services/imapService.js', code);
