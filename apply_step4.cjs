const fs = require('fs');
let p = 'server/index.js';
let c = fs.readFileSync(p, 'utf8');

const mappingCode = `
          // --- STEP 4: AUTO WORKSPACE MAPPING ---
          if (!user.workspaceIds) user.workspaceIds = [];
          if (user.department && dbData.workspaces) {
            const matchingWorkspaces = dbData.workspaces.filter(ws => 
              ws.adGroup && ws.adGroup.toLowerCase() === user.department.toLowerCase()
            );
            matchingWorkspaces.forEach(ws => {
              if (!user.workspaceIds.includes(ws.id)) {
                user.workspaceIds.push(ws.id);
                console.log(\`[LDAP Sync] Auto-assigned \${user.login} to workspace \${ws.name}\`);
              }
            });
          }
          if (user.workspaceIds.length === 0 && dbData.workspaces && dbData.workspaces.find(w => w.id === 'WS-1')) {
             if (!user.workspaceIds.includes('WS-1')) user.workspaceIds.push('WS-1');
          }
          // ---------------------------------------

          await saveCollection('users', dbData.users);
`;

c = c.replace(/\s*await saveCollection\('users', dbData\.users\);/, mappingCode);
fs.writeFileSync(p, c);
