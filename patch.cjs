const fs = require('fs');

// Patch users.js
const usersPath = 'server/routes/users.js';
let usersContent = fs.readFileSync(usersPath, 'utf8');
usersContent = usersContent.replace(/workspaceIds: userData\.workspaceIds \|\| \['WS-1'\] \/\/ Bug #9/g, 'workspaceIds: userData.workspaceIds || []');
fs.writeFileSync(usersPath, usersContent);

// Patch ldapService.js
const ldapPath = 'server/services/ldapService.js';
let ldapContent = fs.readFileSync(ldapPath, 'utf8');

if (!ldapContent.includes('const ensureWorkspace = (dept) => {')) {
  // Inject ensureWorkspace helper
  const mapStr = '  const usersMapByLogin = new Map();';
  const injectedHelper = mapStr + '\n\n  let newWorkspacesAdded = false;\n  const ensureWorkspace = (dept) => {\n    const safeName = (dept || \'Отдел не указан\').trim();\n    if (!dbData.workspaces) dbData.workspaces = [];\n    let ws = dbData.workspaces.find(w => w.name.toLowerCase() === safeName.toLowerCase());\n    if (!ws) {\n      ws = {\n        id: \'WS-DEP-\' + Date.now() + \'-\' + Math.floor(Math.random() * 10000),\n        name: safeName,\n        createdAt: new Date().toISOString()\n      };\n      dbData.workspaces.push(ws);\n      newWorkspacesAdded = true;\n    }\n    return ws.id;\n  };\n';
  ldapContent = ldapContent.replace(mapStr, injectedHelper);

  // Patch matchedUser
  ldapContent = ldapContent.replace('matchedUser.isActive = true;', 'matchedUser.isActive = true;\n      matchedUser.workspaceIds = [ensureWorkspace(matchedUser.department)];');

  // Patch newUser
  ldapContent = ldapContent.replace('isActive: true,', 'isActive: true,\n        workspaceIds: [ensureWorkspace(adUser.department || \'Отдел не указан\')],');

  // Patch end of function to save workspaces
  const saveUsersStr = 'await saveCollection(\'users\', dbData.users);';
  const injectedSaveWs = 'if (newWorkspacesAdded) {\n    await saveCollection(\'workspaces\', dbData.workspaces);\n  }\n  ' + saveUsersStr;
  ldapContent = ldapContent.replace(saveUsersStr, injectedSaveWs);
  
  fs.writeFileSync(ldapPath, ldapContent);
  console.log('ldapService.js and users.js patched successfully');
} else {
  console.log('Already patched');
}

