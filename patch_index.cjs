const fs = require('fs');

let code = fs.readFileSync('server/index.js', 'utf8');

// Inject sanitization for workspaces and migration for workspaceId
const sanitizeStr = `const getSanitizedDbData = () => {
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
    workspaces: dbData.workspaces || [],`;

code = code.replace(/const getSanitizedDbData = \(\) => \(\{\n\s*\.\.\.dbData,\n\s*tasks: sanitizeTasks\(dbData\.tasks\),\n\s*sprints: sanitizeSprints\(dbData\.sprints\),/, sanitizeStr);

// Ensure it closes properly
code = code.replace(/workspaces: dbData\.workspaces \|\| \[\],\n\s*users: sanitizeUsers\(dbData\.users\)/, `    users: sanitizeUsers(dbData.users)`);
// wait, the original was:
// const getSanitizedDbData = () => ({
//   ...dbData,
//   tasks: sanitizeTasks(dbData.tasks),
//   sprints: sanitizeSprints(dbData.sprints),
//   users: sanitizeUsers(dbData.users),
code = code.replace(/sprints: sanitizeSprints\(dbData\.sprints\),/, `sprints: sanitizeSprints(dbData.sprints),\n    workspaces: dbData.workspaces || [],`);

fs.writeFileSync('server/index.js', code);
console.log('Patched index.js for workspaces');
