const fs = require('fs');
let p = 'src/context/TaskContext.tsx';
let c = fs.readFileSync(p, 'utf8');

// Replace bad injections
c = c.replace(/\\n/g, '\n');
c = c.replace(/\\t/g, '\t');
c = c.replace(/\\r/g, '');

// Clean up weird exports if there are multiple
c = c.replace(/<TaskContext\.Provider value=\{\{\n      workspaces,\n      addWorkspace,\n      updateWorkspace,\n      deleteWorkspace,\n      tasks,/, '<TaskContext.Provider value={{\n      workspaces,\n      addWorkspace,\n      updateWorkspace,\n      deleteWorkspace,\n      tasks,');

fs.writeFileSync(p, c);
console.log('Fixed TaskContext properly');
