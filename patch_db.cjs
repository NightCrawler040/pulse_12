const fs = require('fs');
const dbPath = 'server/db.js';
let dbContent = fs.readFileSync(dbPath, 'utf8');

// Patch 1: loadLocalFile
dbContent = dbContent.replace(/localDbData = {\s*tasks: parsed\.tasks.*?notificationEvents: parsed\.notificationEvents \|\| \{\}\s*};/gs, 'const newData = JSON.parse(JSON.stringify(DEFAULT_DB_STATE)); for (const key of Object.keys(DEFAULT_DB_STATE)) { newData[key] = parsed[key] !== undefined ? parsed[key] : DEFAULT_DB_STATE[key]; } localDbData = newData;');

// Patch 2: auto-healing setInterval
dbContent = dbContent.replace(/localDbData = {\s*tasks: allPgData\.tasks.*?processedEmails: allPgData\.processedEmails \|\| \[\]\s*};/gs, 'const newData = JSON.parse(JSON.stringify(DEFAULT_DB_STATE)); for (const key of Object.keys(DEFAULT_DB_STATE)) { newData[key] = allPgData[key] !== undefined ? allPgData[key] : DEFAULT_DB_STATE[key]; } localDbData = newData;');

// Patch 3: saveAllData fallback 1
dbContent = dbContent.replace(/localDbData = {\s*tasks: dataObj\.tasks \|\| \[\],\s*sprints: dataObj\.sprints \|\| \[\],\s*users: dataObj\.users \|\| \[\],\s*groups: dataObj\.groups \|\| \[\],\s*notifications: dataObj\.notifications \|\| \[\],\s*findings: dataObj\.findings \|\| \[\],\s*api_keys: dataObj\.api_keys \|\| \[\],\s*ldap_settings: dataObj\.ldap_settings \|\| \{ \.\.\.defaultLdapSettings \},\s*globalSettings: dataObj\.globalSettings \|\| \{\}\s*};/gs, 'const newData = JSON.parse(JSON.stringify(DEFAULT_DB_STATE)); for (const key of Object.keys(DEFAULT_DB_STATE)) { newData[key] = dataObj[key] !== undefined ? dataObj[key] : DEFAULT_DB_STATE[key]; } localDbData = newData;');

fs.writeFileSync(dbPath, dbContent);
console.log('db.js patched successfully');
