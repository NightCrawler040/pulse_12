const fs = require('fs');
let p = 'src/context/TaskContext.tsx';
let c = fs.readFileSync(p, 'utf8');

const wsFunctions = \`
      addWorkspace: async (ws) => {
        try {
          const res = await fetch('/api/workspaces', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-auth-user': 'usr-1' },
            body: JSON.stringify(ws)
          });
          if (res.ok) {
            const data = await res.json();
            setWorkspaces(prev => [...prev, data]);
          }
        } catch (e) { console.error(e); }
      },
      updateWorkspace: async (id, updates) => {
        try {
          const res = await fetch(\\\`/api/workspaces/\\\${id}\\\`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-auth-user': 'usr-1' },
            body: JSON.stringify(updates)
          });
          if (res.ok) {
            setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
          }
        } catch (e) { console.error(e); }
      },
      deleteWorkspace: async (id) => {
        try {
          const res = await fetch(\\\`/api/workspaces/\\\${id}\\\`, {
            method: 'DELETE',
            headers: { 'x-auth-user': 'usr-1' }
          });
          if (res.ok) {
            setWorkspaces(prev => prev.filter(w => w.id !== id));
          }
        } catch (e) { console.error(e); }
      },
      addApiKey: async (name, source, allowedDepartments) => {
\`;

c = c.replace(/addApiKey: async \(name, source, allowedDepartments\) => \{/, wsFunctions);

// remove the shorthand ones that I added earlier by mistake
c = c.replace(/      addWorkspace,\n/, '');
c = c.replace(/      updateWorkspace,\n/, '');
c = c.replace(/      deleteWorkspace,\n/, '');

fs.writeFileSync(p, c);
console.log('Fixed TaskContext functions');
