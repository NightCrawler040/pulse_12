const fs = require('fs');
let c = fs.readFileSync('server/services/imapService.js', 'utf8');

const search = `    const checkUnread = async () => {
      try {
        const searchOptions = { seen: false };`;

const replace = `    let isProcessing = false;
    const checkUnread = async () => {
      if (isProcessing) return;
      isProcessing = true;
      try {
        const searchOptions = { seen: false };`;

if (c.indexOf(search) !== -1) {
  c = c.replace(search, replace);
  // Now add isProcessing = false in finally block
  const catchSearch = `      } catch (e) {
        console.error('⚠️ [IMAP] Ошибка в процессе чтения:', e.message);
      }
    };`;
  const catchReplace = `      } catch (e) {
        console.error('⚠️ [IMAP] Ошибка в процессе чтения:', e.message);
      } finally {
        isProcessing = false;
      }
    };`;
  // Let's use regex for catchSearch because of encoding
  const regex = /\}\s*catch\s*\(e\)\s*\{\s*console\.error\([^)]+\);\s*\}\s*\};\s*try\s*\{/;
  const match = c.match(regex);
  if (match) {
    c = c.replace(match[0], match[0].replace('}', '} finally { isProcessing = false; }'));
  } else {
    console.log("Could not find catch block");
  }

  fs.writeFileSync('server/services/imapService.js', c);
  console.log("Added isProcessing lock!");
} else {
  console.log("Could not find checkUnread start");
}
