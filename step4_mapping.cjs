const fs = require('fs');

let p = 'server/index.js';
let c = fs.readFileSync(p, 'utf8');

const mapLogic = \`
          if (user) {
            user.ldapDn = ldapUser.dn || user.ldapDn;
            user.authSource = 'LDAP';
            user.isActive = true;
            if (ldapUser.email) user.email = ldapUser.email;
            if (ldapUser.department) user.department = ldapUser.department;
            if (isAdminUser) {
              user.role = 'Системный Админ';
              user.roleType = 'admin';
            }
          } else {
            const newId = \\\`usr-ad-\\\${ldapUser.login || Math.floor(Math.random() * 90000 + 10000)}\\\`;
            user = {
              id: newId,
              login: ldapUser.login,
              email: ldapUser.email,
              name: ldapUser.name || ldapUser.login,
              department: ldapUser.department || 'Корпоративный отдел',
              role: isAdminUser ? 'Системный Админ' : 'Сотрудник',
              roleType: isAdminUser ? 'admin' : 'member',
              authSource: 'LDAP',
              ldapDn: ldapUser.dn,
              isActive: true,
              workspaceIds: [], // Step 4 addition
              createdAt: new Date().toISOString()
            };
            dbData.users.push(user);
          }

          // --- STEP 4: AUTO WORKSPACE MAPPING ---
          if (!user.workspaceIds) user.workspaceIds = [];
          if (user.department && dbData.workspaces) {
            const matchingWorkspaces = dbData.workspaces.filter(ws => 
              ws.adGroup && ws.adGroup.toLowerCase() === user.department.toLowerCase()
            );
            matchingWorkspaces.forEach(ws => {
              if (!user.workspaceIds.includes(ws.id)) {
                user.workspaceIds.push(ws.id);
                console.log(\\\`[LDAP Sync] Auto-assigned \\\${user.login} to workspace \\\${ws.name}\\\`);
              }
            });
          }
          // If no workspace assigned, assign to default WS-1 if it exists
          if (user.workspaceIds.length === 0 && dbData.workspaces && dbData.workspaces.find(w => w.id === 'WS-1')) {
             if (!user.workspaceIds.includes('WS-1')) user.workspaceIds.push('WS-1');
          }
          // ---------------------------------------
\`;

c = c.replace(/          if \(user\) \{\n            user\.ldapDn = ldapUser\.dn[\s\S]*?dbData\.users\.push\(user\);\n          \}/, mapLogic);

fs.writeFileSync(p, c);
console.log('Patched server/index.js for auto-mapping');
