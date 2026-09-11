const fs = require('fs');

// 1. Fix WorkspacesTab.tsx
let pathWs = 'src/components/AdminPanel/WorkspacesTab.tsx';
let contentWs = fs.readFileSync(pathWs, 'utf8');
contentWs = contentWs.replace('import { Workspace } from \'../../types\';', 'import type { Workspace } from \'../../types\';');
contentWs = contentWs.replace(' deleteWorkspace, groups } = useTaskContext();', ' deleteWorkspace } = useTaskContext();');
fs.writeFileSync(pathWs, contentWs);
console.log('Fixed WorkspacesTab');

// 2. Fix AdminPanel.tsx (remove unused WorkspacesTab if needed, or actually USE it)
// It said "WorkspacesTab is declared but its value is never read" because my previous replace failed to insert it.
let pathAdmin = 'src/components/AdminPanel/AdminPanel.tsx';
let contentAdmin = fs.readFileSync(pathAdmin, 'utf8');
// Check if <WorkspacesTab /> is actually used
if (!contentAdmin.includes('<WorkspacesTab />')) {
  // It's not used, let's insert it correctly.
  contentAdmin = contentAdmin.replace('<div className="admin-content">', '<div className="admin-content">\n        {activeTab === \'workspaces\' && <WorkspacesTab />}');
  fs.writeFileSync(pathAdmin, contentAdmin);
}
console.log('Fixed AdminPanel');

// 3. Fix TaskContext.tsx (unused variables and missing exports)
let pathCtx = 'src/context/TaskContext.tsx';
let contentCtx = fs.readFileSync(pathCtx, 'utf8');
// The issue is that I declared [workspaces, setWorkspaces] but they are not used, OR I failed to export them in the return value.
// "Type ... is missing the following properties: workspaces, addWorkspace, updateWorkspace, deleteWorkspace"
if (!contentCtx.includes('workspaces,')) {
    // If we look at the return value of TaskProvider:
    // return <TaskContext.Provider value={{ tasks, users, groups, ... }}>
    const returnRegex = /return \(\s*<TaskContext\.Provider\s+value=\{\{([\s\S]*?)\}\}\s*>/;
    const match = contentCtx.match(returnRegex);
    if (match) {
        if (!match[1].includes('workspaces,')) {
            contentCtx = contentCtx.replace(returnRegex, (m, p1) => {
                return \`return (\\n    <TaskContext.Provider\\n      value={{\\n        workspaces,\\n        addWorkspace,\\n        updateWorkspace,\\n        deleteWorkspace,\\n\${p1}}}\\n    >\`;
            });
        }
    }
}
fs.writeFileSync(pathCtx, contentCtx);
console.log('Fixed TaskContext');
