const fs = require('fs');

// 1. Update initialData.js
let initialDataStr = fs.readFileSync('server/initialData.js', 'utf-8');
if (!initialDataStr.includes('initialWorkspaces')) {
  initialDataStr += `
export const initialWorkspaces = [
  {
    id: 'WS-1',
    name: 'Security & Engineering',
    ownerId: 'usr-1',
    adGroup: 'Engineering',
    enabledModules: ['kanban', 'security_center', 'integrations'],
    createdAt: new Date().toISOString()
  }
];
`;
  fs.writeFileSync('server/initialData.js', initialDataStr);
  console.log('Updated initialData.js');
}

// 2. Update db.js
let dbStr = fs.readFileSync('server/db.js', 'utf-8');
if (!dbStr.includes('initialWorkspaces')) {
  dbStr = dbStr.replace(
    /import \{ initialUsers, initialSprints, initialTasks, initialGroups, initialFindings, initialApiKeys \} from '\.\/initialData\.js';/,
    "import { initialUsers, initialSprints, initialTasks, initialGroups, initialFindings, initialApiKeys, initialWorkspaces } from './initialData.js';"
  );
  
  dbStr = dbStr.replace(
    /groups: initialGroups,/,
    "groups: initialGroups,\n    workspaces: initialWorkspaces,"
  );
  
  dbStr = dbStr.replace(
    /await client\.query\('INSERT INTO pulse_store \(key, data\) VALUES \(\$1, \$2\) ON CONFLICT \(key\) DO NOTHING', \['groups', JSON\.stringify\(initialGroups\)]\);/,
    "await client.query('INSERT INTO pulse_store (key, data) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', ['groups', JSON.stringify(initialGroups)]);\n      await client.query('INSERT INTO pulse_store (key, data) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', ['workspaces', JSON.stringify(initialWorkspaces)]);"
  );
  
  dbStr = dbStr.replace(
    /groups: allPgData\.groups \|\| \[\],/,
    "groups: allPgData.groups || [],\n        workspaces: allPgData.workspaces || [],"
  );
  
  fs.writeFileSync('server/db.js', dbStr);
  console.log('Updated db.js');
}
