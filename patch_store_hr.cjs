const fs = require('fs');
let code = fs.readFileSync('server/store.js', 'utf8');

code = code.replace(/users: sanitizeUsers\(dbData\.users\),/, `users: sanitizeUsers(dbData.users),
    hr_orders: dbData.hr_orders || [],
    hrSettings: dbData.hrSettings || {},`);

fs.writeFileSync('server/store.js', code);
