const fs = require('fs');
let p = 'src/context/TaskContext.tsx';
let c = fs.readFileSync(p, 'utf8');
c = c.replace('if (Array.isArray(data.api_keys)) setApiKeys(data.api_keys);', 'if (Array.isArray(data.api_keys)) setApiKeys(data.api_keys);\n          if (Array.isArray(data.workspaces)) setWorkspaces(data.workspaces);');
fs.writeFileSync(p, c);
