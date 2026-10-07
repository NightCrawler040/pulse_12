const fs = require('fs');
let code = fs.readFileSync('server/migrate_workspaces.js', 'utf8');

code = code.replace(/const safeName = \(dept \|\| '.*?'\)\.trim\(\);/, "const safeName = (dept || 'Отдел не указан').trim();");

code = code.replace(/let ws = dbData\.workspaces\.find\(w => w\.name\.toLowerCase\(\) === safeName\.toLowerCase\(\)\);/, "let ws = dbData.workspaces.find(w => (w.adGroup && w.adGroup.toLowerCase() === safeName.toLowerCase()) || (w.name && w.name.toLowerCase() === safeName.toLowerCase()));");

code = code.replace(/ws = \{\s*id: 'WS-DEP-' \+ Date\.now\(\) \+ '-' \+ Math\.floor\(Math\.random\(\) \* 10000\),\s*name: safeName,\s*createdAt: new Date\(\)\.toISOString\(\)\s*\};/, "ws = { id: 'WS-DEP-' + Date.now() + '-' + Math.floor(Math.random() * 10000), name: safeName, adGroup: safeName, createdAt: new Date().toISOString() };");

// Fix the fallback assignment for tasks without owners
code = code.replace(/t\.workspaceId = ensureWorkspace\('.*?'\);/g, "t.workspaceId = ensureWorkspace('Системный');");

fs.writeFileSync('server/migrate_workspaces.js', code, 'utf8');
console.log('migrate_workspaces.js patched successfully');
