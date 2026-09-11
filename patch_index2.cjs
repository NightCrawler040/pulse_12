const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

const targetFunction = `const getSanitizedDbData = () => {
  // Ensure workspaces exists
  if (!dbData.workspaces) {
    dbData.workspaces = [
      {
        id: 'WS-1',
        name: 'Security & Engineering',
        ownerId: 'usr-1',
        adGroup: 'Engineering',
        enabledModules: ['kanban', 'security_center', 'integrations'],
        createdAt: new Date().toISOString()
      }
    ];
  }
  
  // Migrate tasks
  if (dbData.tasks) {
    dbData.tasks.forEach(t => { if (!t.workspaceId) t.workspaceId = 'WS-1'; });
  }
  // Migrate findings
  if (dbData.findings) {
    dbData.findings.forEach(f => { if (!f.workspaceId) f.workspaceId = 'WS-1'; });
  }

  return {
    ...dbData,
    tasks: sanitizeTasks(dbData.tasks),
    sprints: sanitizeSprints(dbData.sprints),
    workspaces: dbData.workspaces || [],
    notifications: Array.isArray(dbData.notifications) ? dbData.notifications : [],
    findings: Array.isArray(dbData.findings) ? dbData.findings : [],
    api_keys: Array.isArray(dbData.api_keys) ? dbData.api_keys : [],
    kataHashes: Array.isArray(dbData.kataHashes) ? dbData.kataHashes : [],
    ldap_settings: sanitizeLdapSettings(dbData.ldap_settings),
    users: sanitizeUsers(dbData.users)
  };
};`;

code = code.replace(/const getSanitizedDbData = \(\) => \(\{[\s\S]*?\}\);/, targetFunction);
fs.writeFileSync('server/index.js', code);
