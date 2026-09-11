const fs = require('fs');
const path = require('path');

// 1. Update src/types/index.ts
let typesPath = 'src/types/index.ts';
let typesContent = fs.readFileSync(typesPath, 'utf8');
if (!typesContent.includes('export interface Workspace')) {
  typesContent += `\nexport interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  adGroup: string;
  enabledModules: string[];
  createdAt: string;
}\n`;
  fs.writeFileSync(typesPath, typesContent);
}

// 2. Update src/context/TaskContext.tsx
let contextPath = 'src/context/TaskContext.tsx';
let contextContent = fs.readFileSync(contextPath, 'utf8');
if (!contextContent.includes('workspaces: Workspace[]')) {
  contextContent = contextContent.replace(/import type \{([^}]+)\} from '\.\.\/types';/, (match, group1) => {
    return `import type {${group1}, Workspace } from '../types';`;
  });
  
  contextContent = contextContent.replace(/export interface TaskContextType \{/, `export interface TaskContextType {\n  workspaces: Workspace[];\n  addWorkspace: (ws: Omit<Workspace, 'id' | 'createdAt'>) => void;\n  updateWorkspace: (id: string, updates: Partial<Workspace>) => void;\n  deleteWorkspace: (id: string) => void;`);
  
  contextContent = contextContent.replace(/const \[apiKeys, setApiKeys\] = useState<ApiKeySettings\[\]>\(\[\]\);/, `const [apiKeys, setApiKeys] = useState<ApiKeySettings[]>([]);\n  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);`);
  
  contextContent = contextContent.replace(/setApiKeys\(Array\.isArray\(serverData\.api_keys\) \? serverData\.api_keys : \[\]\);/, `setApiKeys(Array.isArray(serverData.api_keys) ? serverData.api_keys : []);\n        setWorkspaces(Array.isArray(serverData.workspaces) ? serverData.workspaces : []);`);
  
  contextContent = contextContent.replace(/const addApiKey = async \(/, `
  const addWorkspace = async (ws: Omit<Workspace, 'id' | 'createdAt'>) => {
    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-user': currentUser?.id || '' },
        body: JSON.stringify(ws)
      });
      if (response.ok) {
        const newWs = await response.json();
        setWorkspaces(prev => [newWs, ...prev]);
      }
    } catch (error) { console.error('Error adding workspace:', error); }
  };
  const updateWorkspace = async (id: string, updates: Partial<Workspace>) => {
    try {
      const response = await fetch(\`/api/workspaces/\${id}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-auth-user': currentUser?.id || '' },
        body: JSON.stringify(updates)
      });
      if (response.ok) {
        setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
      }
    } catch (error) { console.error('Error updating workspace:', error); }
  };
  const deleteWorkspace = async (id: string) => {
    try {
      const response = await fetch(\`/api/workspaces/\${id}\`, {
        method: 'DELETE',
        headers: { 'x-auth-user': currentUser?.id || '' }
      });
      if (response.ok) {
        setWorkspaces(prev => prev.filter(w => w.id !== id));
      }
    } catch (error) { console.error('Error deleting workspace:', error); }
  };

  const addApiKey = async (`);
  
  contextContent = contextContent.replace(/addApiKey, deleteApiKey/, `addApiKey, deleteApiKey, workspaces, addWorkspace, updateWorkspace, deleteWorkspace`);
  
  fs.writeFileSync(contextPath, contextContent);
}

// 3. Update server/index.js
let serverPath = 'server/index.js';
let serverContent = fs.readFileSync(serverPath, 'utf8');
if (!serverContent.includes('app.post(\'/api/workspaces\'')) {
  const wsEndpoints = `
// --- WORKSPACES API ---
app.post('/api/workspaces', requireAdmin, (req, res) => {
  const newWs = {
    ...req.body,
    id: \`WS-\${Date.now()}\`,
    createdAt: new Date().toISOString()
  };
  if (!dbData.workspaces) dbData.workspaces = [];
  dbData.workspaces.push(newWs);
  broadcastUpdate('workspaces');
  res.status(201).json(newWs);
});
app.put('/api/workspaces/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  dbData.workspaces = dbData.workspaces.map(w => w.id === id ? { ...w, ...updates } : w);
  broadcastUpdate('workspaces');
  res.json({ success: true });
});
app.delete('/api/workspaces/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  dbData.workspaces = dbData.workspaces.filter(w => w.id !== id);
  broadcastUpdate('workspaces');
  res.json({ success: true });
});

app.post('/api/tasks'`;
  serverContent = serverContent.replace(/app\.post\('\/api\/tasks'/, wsEndpoints);
  fs.writeFileSync(serverPath, serverContent);
}

// 4. AdminPanel.tsx Update
let adminPath = 'src/components/AdminPanel/AdminPanel.tsx';
let adminContent = fs.readFileSync(adminPath, 'utf8');
if (!adminContent.includes('workspaces: <WorkspacesTab />')) {
  adminContent = adminContent.replace(/import \{ FortigateSettingsTab \} from '\.\/FortigateSettingsTab';/, `import { FortigateSettingsTab } from './FortigateSettingsTab';\nimport { WorkspacesTab } from './WorkspacesTab';`);
  
  adminContent = adminContent.replace(/useState<'users' \| 'groups' \| 'integrations' \| 'ldap' \| 'mail' \| 'fortigate'>\('users'\)/, `useState<'workspaces' | 'users' | 'groups' | 'integrations' | 'ldap' | 'mail' | 'fortigate'>('workspaces')`);
  
  adminContent = adminContent.replace(/<button\n\s+className=\{\`admin-nav-item \$\{activeTab === 'users' \? 'active' : ''\}\`\}\n\s+onClick=\{\(\) => setActiveTab\('users'\)\}/, `<button
          className={\`admin-nav-item \${activeTab === 'workspaces' ? 'active' : ''}\`}
          onClick={() => setActiveTab('workspaces')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
          Пространства
        </button>\n        <button
          className={\`admin-nav-item \${activeTab === 'users' ? 'active' : ''}\`}
          onClick={() => setActiveTab('users')}`);
          
  adminContent = adminContent.replace(/<div className="admin-content">\n\s*\{activeTab === 'users' && \(/, `<div className="admin-content">\n        {activeTab === 'workspaces' && <WorkspacesTab />}\n        {activeTab === 'users' && (`);
  
  fs.writeFileSync(adminPath, adminContent);
}

console.log('Done modifying core files for step 3');
