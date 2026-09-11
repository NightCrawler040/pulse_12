const fs = require('fs');

// 1. Fix AdminPanel.tsx
let adminPath = 'src/components/AdminPanel/AdminPanel.tsx';
let adminContent = fs.readFileSync(adminPath, 'utf8');
if (!adminContent.includes('<WorkspacesTab />')) {
  adminContent = adminContent.replace('<div className="admin-content">', '<div className="admin-content">\n        {activeTab === \'workspaces\' && <WorkspacesTab />}');
  fs.writeFileSync(adminPath, adminContent);
  console.log('Fixed AdminPanel.tsx');
}

// 2. Fix TaskContext.tsx
let contextPath = 'src/context/TaskContext.tsx';
let contextContent = fs.readFileSync(contextPath, 'utf8');

// Insert interface methods if missing
if (!contextContent.includes('workspaces: Workspace[];')) {
  contextContent = contextContent.replace('interface TaskContextType {', `interface TaskContextType {
  workspaces: Workspace[];
  addWorkspace: (ws: Omit<Workspace, 'id' | 'createdAt'>) => void;
  updateWorkspace: (id: string, updates: Partial<Workspace>) => void;
  deleteWorkspace: (id: string) => void;`);
}

// Insert state variables if missing
if (!contextContent.includes('const [workspaces, setWorkspaces] = useState<Workspace[]>([]);')) {
  contextContent = contextContent.replace('const [apiKeys, setApiKeys] = useState<ApiKeySettings[]>([]);', `const [apiKeys, setApiKeys] = useState<ApiKeySettings[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);`);
}

// Insert setWorkspaces call inside useEffect
if (!contextContent.includes('setWorkspaces(Array.isArray(serverData.workspaces) ? serverData.workspaces : []);')) {
  contextContent = contextContent.replace('setApiKeys(Array.isArray(serverData.api_keys) ? serverData.api_keys : []);', `setApiKeys(Array.isArray(serverData.api_keys) ? serverData.api_keys : []);
        setWorkspaces(Array.isArray(serverData.workspaces) ? serverData.workspaces : []);`);
}

// Insert Workspace CRUD functions
if (!contextContent.includes('const addWorkspace = async')) {
  contextContent = contextContent.replace('const addApiKey = async', `const addWorkspace = async (ws: Omit<Workspace, 'id' | 'createdAt'>) => {
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

  const addApiKey = async`);
}

// Ensure exports include Workspace methods
if (!contextContent.includes('addWorkspace, updateWorkspace, deleteWorkspace')) {
  contextContent = contextContent.replace('addApiKey, deleteApiKey,', 'addApiKey, deleteApiKey, workspaces, addWorkspace, updateWorkspace, deleteWorkspace,');
}

fs.writeFileSync(contextPath, contextContent);
console.log('Fixed TaskContext.tsx');
