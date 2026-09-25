const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

const s1 = code.indexOf('const getSanitizedDbDataForUser = (user) => {');
const e1 = code.indexOf('// Middleware для проверки подписи');

if (s1 !== -1 && e1 !== -1) {
  code = code.substring(0, s1) + code.substring(e1);
}

fs.writeFileSync('server/index.js', code);
