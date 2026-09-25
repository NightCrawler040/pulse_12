const fs = require('fs');
let code = fs.readFileSync('server/services/imapService.js', 'utf8');

code = code.replace(/console\.error\('❌ \[IMAP\] Ошибка подключения:', err\.message\);/, 
  "console.error('❌ [IMAP] Ошибка подключения:', err.message, err.response || '', err);");

fs.writeFileSync('server/services/imapService.js', code);
