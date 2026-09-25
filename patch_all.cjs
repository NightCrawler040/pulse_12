const fs = require('fs');

function patchTasks() {
  let code = fs.readFileSync('server/routes/tasks.js', 'utf8');
  
  code = code.replace(/import express from 'express';/, "import express from 'express';\nimport { requireWorkspaceAccess } from '../middlewares/workspace.js';");

  code = code.replace(/router\.get\('\/', requireAuth, async \(req, res\) => \{\s*res\.json\(req\.dbData\.tasks \|\| \[\]\);\s*\}\);/,
`router.get('/', requireAuth, requireWorkspaceAccess, async (req, res) => {
    let tasks = req.dbData.tasks || [];
    if (req.currentUser.roleType !== 'admin') {
      const wsIds = req.currentUser.workspaceIds || [];
      tasks = tasks.filter(t => !t.workspaceId || wsIds.includes(t.workspaceId));
    }
    res.json(tasks);
  });`);

  code = code.replace(/router\.post\('\/', requireAuth, async \(req, res\) => \{/, "router.post('/', requireAuth, requireWorkspaceAccess, async (req, res) => {");

  code = code.replace(/let wsId = newTaskData\.workspaceId;(\s*if \(!wsId && req\.currentUser\) \{[\s\S]*?\})/,
`let wsId = newTaskData.workspaceId;
    if (wsId && req.currentUser && req.currentUser.roleType !== 'admin') {
      if (!(req.currentUser.workspaceIds || []).includes(wsId)) {
        return res.status(403).json({ error: 'Нет доступа к указанному workspace' });
      }
    }
$1`);

  code = code.replace(/router\.put\('\/:id', requireAuth, async \(req, res\) => \{/, "router.put('/:id', requireAuth, requireWorkspaceAccess, async (req, res) => {");
  
  // Inject into PUT
  code = code.replace(/const existingTask = \(req\.dbData\.tasks \|\| \[\]\)\.find\(t => t\.id === id\);\s*if \(!existingTask\) \{\s*return res\.status\(404\)\.json\(\{ error: '.*?' \}\);\s*\}/, 
`const existingTask = (req.dbData.tasks || []).find(t => t.id === id);
    if (!existingTask) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }
    if (req.currentUser.roleType !== 'admin') {
      if (existingTask.workspaceId && !(req.currentUser.workspaceIds || []).includes(existingTask.workspaceId)) {
        return res.status(403).json({ error: 'Нет доступа к редактированию задачи из этого workspace' });
      }
    }`);

  code = code.replace(/router\.delete\('\/:id', requireAuth, async \(req, res\) => \{/, "router.delete('/:id', requireAuth, requireWorkspaceAccess, async (req, res) => {");
  
  // Inject into DELETE
  const deleteRegex = /const existingTask = \(req\.dbData\.tasks \|\| \[\]\)\.find\(t => t\.id === id\);\s*if \(existingTask\) \{/;
  // We use replace with function so we only replace the FIRST occurrence we see from here (which will be in DELETE if we do it globally? Wait, there is existingTask in PUT and DELETE).
  // Actually, let's just do a string replace, it's safer.
  let deleteIndex = code.indexOf('router.delete');
  let firstPart = code.substring(0, deleteIndex);
  let secondPart = code.substring(deleteIndex);
  
  secondPart = secondPart.replace(/const existingTask = \(req\.dbData\.tasks \|\| \[\]\)\.find\(t => t\.id === id\);\s*if \(existingTask\) \{/, 
`const existingTask = (req.dbData.tasks || []).find(t => t.id === id);
    if (existingTask) {
      if (req.currentUser.roleType !== 'admin') {
        if (existingTask.workspaceId && !(req.currentUser.workspaceIds || []).includes(existingTask.workspaceId)) {
          return res.status(403).json({ error: 'Нет доступа к удалению задачи из этого workspace' });
        }
      }`);
      
  code = firstPart + secondPart;

  fs.writeFileSync('server/routes/tasks.js', code);
}

function patchOthers(filename, entityName, isRequireAdmin) {
  let code = fs.readFileSync(filename, 'utf8');
  
  code = code.replace(/import express from 'express';/, "import express from 'express';\nimport { requireWorkspaceAccess } from '../middlewares/workspace.js';");

  // GET
  const getRegex = new RegExp(`router\\.get\\('\\/', (requireAuth|requireAdmin), async \\(req, res\\) => \\{\\s*res\\.json\\(req\\.dbData\\.${entityName} \\|\\| \\[\\]\\);\\s*\\}\\);`);
  code = code.replace(getRegex,
`router.get('/', $1, requireWorkspaceAccess, async (req, res) => {
    let items = req.dbData.${entityName} || [];
    if (req.currentUser.roleType !== 'admin') {
      const wsIds = req.currentUser.workspaceIds || [];
      items = items.filter(t => !t.workspaceId || wsIds.includes(t.workspaceId));
    }
    res.json(items);
  });`);

  // POST
  code = code.replace(/router\.post\('\/', (requireAuth|requireAdmin), async \(req, res\) => \{/, "router.post('/', $1, requireWorkspaceAccess, async (req, res) => {");
  // insert check right after getting body
  const bodyRegex = new RegExp(`const .*?Data = req.body;`);
  code = code.replace(bodyRegex, 
`$&
  if (req.body.workspaceId && req.currentUser && req.currentUser.roleType !== 'admin') {
    if (!(req.currentUser.workspaceIds || []).includes(req.body.workspaceId)) {
      return res.status(403).json({ error: 'Нет доступа к указанному workspace' });
    }
  }`);

  // PUT
  code = code.replace(/router\.put\('\/:id', (requireAuth|requireAdmin), async \(req, res\) => \{/, "router.put('/:id', $1, requireWorkspaceAccess, async (req, res) => {");
  
  // DELETE
  code = code.replace(/router\.delete\('\/:id', (requireAuth|requireAdmin), async \(req, res\) => \{/, "router.delete('/:id', $1, requireWorkspaceAccess, async (req, res) => {");

  // Inside PUT and DELETE we need to check existing item
  const existingRegex = new RegExp(`const existing = \\(req\\.dbData\\.${entityName} \\|\\| \\[\\]\\)\\.find\\(.*\\);`);
  code = code.replace(new RegExp(`const existing = \\(req\\.dbData\\.${entityName} \\|\\| \\[\\]\\)\\.find\\(.*\\);`, 'g'),
`$&
  if (existing && req.currentUser && req.currentUser.roleType !== 'admin') {
    if (existing.workspaceId && !(req.currentUser.workspaceIds || []).includes(existing.workspaceId)) {
      return res.status(403).json({ error: 'Нет доступа к объекту в данном workspace' });
    }
  }`);
  
  fs.writeFileSync(filename, code);
}

patchTasks();
patchOthers('server/routes/findings.js', 'findings');
patchOthers('server/routes/groups.js', 'groups');
patchOthers('server/routes/sprints.js', 'sprints');
