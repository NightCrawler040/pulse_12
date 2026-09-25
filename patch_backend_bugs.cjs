const fs = require('fs');

// Patch index.js WebSocket init
let indexCode = fs.readFileSync('server/index.js', 'utf8');
// Remove `socket.emit('init-data', getSanitizedDbData());` from connection
indexCode = indexCode.replace(/socket\.emit\('init-data', getSanitizedDbData\(\)\);/, 
  "// Removed init-data on raw connection (Bug #5). Will send after user-online.");
fs.writeFileSync('server/index.js', indexCode);

// Patch users.js to set default workspaceId
let usersCode = fs.readFileSync('server/routes/users.js', 'utf8');
usersCode = usersCode.replace(/isActive: true/, 
  "isActive: true,\n  workspaceIds: userData.workspaceIds || ['WS-1'] // Bug #9");
fs.writeFileSync('server/routes/users.js', usersCode);

// Patch sprints, groups, findings backend for fallback
const routes = ['server/routes/sprints.js', 'server/routes/groups.js', 'server/routes/findings.js', 'server/routes/tasks.js'];
routes.forEach(route => {
  let code = fs.readFileSync(route, 'utf8');
  // Usually the payload is `const data = req.body` or `const sprintData = req.body`.
  // We can just find `const newId = ...` and inject the fallback logic.
  code = code.replace(/const newId = /g, 
    `if (!req.body.workspaceId && req.currentUser && req.currentUser.workspaceIds && req.currentUser.workspaceIds.length > 0) {
      req.body.workspaceId = req.currentUser.workspaceIds[0];
    }
    const newId = `);
  fs.writeFileSync(route, code);
});
