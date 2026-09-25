const fs = require('fs');

let code = fs.readFileSync('server/services/imapService.js', 'utf8');
const marker = 'if (!pulseUser) {'; 
const markerIdx = code.indexOf(marker);
if (markerIdx === -1) {
  console.log("Not found marker");
  process.exit(1);
}

const endString = 'return;\n      }';
const endIdx = code.indexOf(endString, markerIdx);
if (endIdx === -1) {
  console.log("Not found endString");
  process.exit(1);
}

const splitIdx = endIdx + endString.length;
const before = code.substring(0, splitIdx);
const after = code.substring(splitIdx);

const hrLogic = `
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
        if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        const safeFilename = 'hr_order_' + Date.now() + '_' + hrPdfAttachment.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = path.join(UPLOADS_DIR, safeFilename);
        fs.writeFileSync(filePath, hrPdfAttachment.content);
        
        hrOrderData.pdfUrl = '/api/uploads/' + safeFilename;

        const hrSettings = currentDbData.hrSettings || { workspaceId: 'WS-1', groupId: null };
        const targetWsId = hrSettings.workspaceId;

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

        console.log('[IMAP] Создан новый HR Приказ (JML) для', hrOrderData.employeeName);
        
        // Push notification handling
        if (hrSettings.groupId) {
          const group = currentDbData.groups?.find(g => g.id === hrSettings.groupId);
          if (group && currentBroadcast) {
             group.members.forEach(memberId => {
               currentBroadcast('data-updated', { hr_orders: currentDbData.hr_orders }, memberId);
             });
          }
        } else if (currentBroadcast) {
           currentBroadcast('data-updated', { hr_orders: currentDbData.hr_orders });
        }
        return;
      }
`;

fs.writeFileSync('server/services/imapService.js', before + hrLogic + after);
console.log('Injected successfully');
