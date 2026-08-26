const fs = require('fs');
let c = fs.readFileSync('server/services/imapService.js', 'utf8');

const search = `    const checkUnread = async () => {
      try {
        const searchOptions = { seen: false };
        for await (let msg of client.fetch(searchOptions, { source: true, uid: true, headers: ['message-id'] })) {
          await processEmail(msg, msg.uid);
          await client.messageFlagsAdd(msg.uid, ['\\\\Seen'], { uid: true });
        }
      } catch (e) {
        console.error('`; // Use indexof up to here

const targetIdx = c.indexOf(`    const checkUnread = async () => {`);
if (targetIdx !== -1) {
  const endIdx = c.indexOf(`      try {\n        // 1.`, targetIdx);
  if (endIdx !== -1) {
    const originalBlock = c.substring(targetIdx, endIdx);
    
    // We replace the original block
    const newBlock = `    let isProcessing = false;
    const checkUnread = async () => {
      if (isProcessing) return;
      isProcessing = true;
      try {
        const searchOptions = { seen: false };
        for await (let msg of client.fetch(searchOptions, { source: true, uid: true, headers: ['message-id'] })) {
          await processEmail(msg, msg.uid);
          await client.messageFlagsAdd(msg.uid, ['\\\\Seen'], { uid: true });
        }
      } catch (e) {
        console.error('⚠️ [IMAP] Ошибка при проверке почты:', e.message);
      } finally {
        isProcessing = false;
      }
    };\n\n`;

    c = c.replace(originalBlock, newBlock);
    fs.writeFileSync('server/services/imapService.js', c);
    console.log("Success! Fixed overlap.");
  } else {
    console.log("Could not find end of checkUnread block");
  }
} else {
    console.log("Could not find checkUnread start");
}
