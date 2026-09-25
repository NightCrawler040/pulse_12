const fs = require('fs');
let code = fs.readFileSync('server/db.js', 'utf8');

// Add hr_orders and hrSettings to localDbData
code = code.replace(/api_keys: \[\],/, "api_keys: [],\n  hr_orders: [],\n  hrSettings: {},");

// Add to result in getAllData
code = code.replace(/api_keys: \[\],/, "api_keys: [],\n        hr_orders: [],\n        hrSettings: {},");

fs.writeFileSync('server/db.js', code);
