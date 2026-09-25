const fs = require('fs');

function patchRoute(filename, entityName) {
  let code = fs.readFileSync(filename, 'utf8');

  // Insert import
  if (!code.includes('requireWorkspaceAccess')) {
    code = code.replace(/import express from 'express';/, "import express from 'express';\nimport { requireWorkspaceAccess } from '../middlewares/workspace.js';");
  }

  // Update GET /
  const getRegex = new RegExp(`router\\.get\\('\\/', requireAuth, async \\(req, res\\) => \\{\\s*res\\.json\\(req\\.dbData\\.${entityName} \\|\\| \\[\\]\\);\\s*\\}\\);`);
  code = code.replace(getRegex,
`router.get('/', requireAuth, requireWorkspaceAccess, async (req, res) => {
    let items = req.dbData.${entityName} || [];
    if (req.currentUser.roleType !== 'admin') {
      const wsIds = req.currentUser.workspaceIds || [];
      items = items.filter(t => !t.workspaceId || wsIds.includes(t.workspaceId));
    }
    res.json(items);
  });`);

  // Sprints/Groups use requireAdmin, so they don't need GET filtering if only admins can access them?
  // Wait, sprints and groups are accessed by normal users! But the creation/editing is requireAdmin.
  
  fs.writeFileSync(filename, code);
}

patchRoute('server/routes/findings.js', 'findings');
patchRoute('server/routes/sprints.js', 'sprints');
patchRoute('server/routes/groups.js', 'groups');

