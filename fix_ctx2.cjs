const fs = require('fs');
let p = 'src/context/TaskContext.tsx';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(/value=\{\{\n      workspaces,\n/, "value={{\n      activeWorkspaceId,\n      setActiveWorkspaceId,\n      workspaces,\n");

fs.writeFileSync(p, c);
