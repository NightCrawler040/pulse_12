const fs = require('fs');
let p = 'src/components/AdminPanel/AdminPanel.tsx';
let c = fs.readFileSync(p, 'utf8');

if (!c.includes('{activeTab === \'workspaces\' && <WorkspacesTab />}')) {
  c = c.replace(/\{activeTab === 'users' \? \(/, "{activeTab === 'workspaces' && <WorkspacesTab />}\n        {activeTab === 'users' ? (");
  fs.writeFileSync(p, c);
}
