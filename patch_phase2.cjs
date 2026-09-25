const fs = require('fs');

let wsCode = fs.readFileSync('server/routes/workspaces.js', 'utf8');

// Replace DELETE logic in workspaces.js
const deleteWsRegex = /router\.delete\('\/:id', requireAdmin, async \(req, res\) => \{[\s\S]*?req\.dbData\.workspaces = req\.dbData\.workspaces\.filter\(w => w\.id !== id\);/;
wsCode = wsCode.replace(deleteWsRegex,
`router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  
  // Cascade migration to WS-1
  if (req.dbData.tasks) {
    req.dbData.tasks = req.dbData.tasks.map(t => t.workspaceId === id ? { ...t, workspaceId: 'WS-1' } : t);
  }
  if (req.dbData.sprints) {
    req.dbData.sprints = req.dbData.sprints.map(s => s.workspaceId === id ? { ...s, workspaceId: 'WS-1' } : s);
  }
  if (req.dbData.groups) {
    req.dbData.groups = req.dbData.groups.map(g => g.workspaceId === id ? { ...g, workspaceId: 'WS-1' } : g);
  }
  if (req.dbData.api_keys) {
    req.dbData.api_keys = req.dbData.api_keys.map(k => k.workspaceId === id ? { ...k, workspaceId: 'WS-1' } : k);
  }
  if (req.dbData.findings) {
    req.dbData.findings = req.dbData.findings.map(f => f.workspaceId === id ? { ...f, workspaceId: 'WS-1' } : f);
  }
  if (req.dbData.users) {
    req.dbData.users = req.dbData.users.map(u => ({
      ...u,
      workspaceIds: (u.workspaceIds || []).filter(wid => wid !== id)
    }));
  }

  req.dbData.workspaces = req.dbData.workspaces.filter(w => w.id !== id);`);
fs.writeFileSync('server/routes/workspaces.js', wsCode);

// Patch promote logic in findings.js
let findCode = fs.readFileSync('server/routes/findings.js', 'utf8');
findCode = findCode.replace(/const promotedTask = \{/, 
`const promotedTask = {
      workspaceId: finding.workspaceId || 'WS-1', // Inherit workspace!`);
fs.writeFileSync('server/routes/findings.js', findCode);
