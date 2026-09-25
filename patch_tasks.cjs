const fs = require('fs');
let code = fs.readFileSync('server/routes/tasks.js', 'utf8');

// Insert import
code = code.replace(/import express from 'express';/, "import express from 'express';\nimport { requireWorkspaceAccess } from '../middlewares/workspace.js';");

// Update GET /
code = code.replace(/router\.get\('\/', requireAuth, async \(req, res\) => \{\s*res\.json\(req\.dbData\.tasks \|\| \[\]\);\s*\}\);/,
`router.get('/', requireAuth, requireWorkspaceAccess, async (req, res) => {
    let tasks = req.dbData.tasks || [];
    if (req.currentUser.roleType !== 'admin') {
      const wsIds = req.currentUser.workspaceIds || [];
      tasks = tasks.filter(t => !t.workspaceId || wsIds.includes(t.workspaceId));
    }
    res.json(tasks);
  });`);

// Update POST / checks
code = code.replace(/let wsId = newTaskData\.workspaceId;\s*if \(!wsId && req\.currentUser\) \{[\s\S]*?\}/,
`let wsId = newTaskData.workspaceId;
    if (wsId && req.currentUser && req.currentUser.roleType !== 'admin') {
      if (!(req.currentUser.workspaceIds || []).includes(wsId)) {
        return res.status(403).json({ error: 'Нет доступа к указанному workspace' });
      }
    }
    if (!wsId && req.currentUser) {
      wsId = (req.currentUser.workspaceIds && req.currentUser.workspaceIds.length > 0) ? req.currentUser.workspaceIds[0] : 'WS-1';
    }`);

// Update POST / signature
code = code.replace(/router\.post\('\/', requireAuth, async \(req, res\) => \{/, "router.post('/', requireAuth, requireWorkspaceAccess, async (req, res) => {");

// Update PUT /:id
code = code.replace(/router\.put\('\/:id', requireAuth, async \(req, res\) => \{/,
`router.put('/:id', requireAuth, requireWorkspaceAccess, async (req, res) => {
    const { id } = req.params;
    const existingTask = (req.dbData.tasks || []).find(t => t.id === id);
    if (!existingTask) return res.status(404).json({ error: 'Task not found' });
    if (req.currentUser.roleType !== 'admin') {
      if (existingTask.workspaceId && !(req.currentUser.workspaceIds || []).includes(existingTask.workspaceId)) {
        return res.status(403).json({ error: 'Нет доступа к редактированию задачи из этого workspace' });
      }
    }`);

// Update DELETE /:id
code = code.replace(/router\.delete\('\/:id', requireAuth, async \(req, res\) => \{/,
`router.delete('/:id', requireAuth, requireWorkspaceAccess, async (req, res) => {
    const { id } = req.params;
    const existingTask = (req.dbData.tasks || []).find(t => t.id === id);
    if (!existingTask) return res.status(404).json({ error: 'Task not found' });
    if (req.currentUser.roleType !== 'admin') {
      if (existingTask.workspaceId && !(req.currentUser.workspaceIds || []).includes(existingTask.workspaceId)) {
        return res.status(403).json({ error: 'Нет доступа к удалению задачи из этого workspace' });
      }
    }`);

fs.writeFileSync('server/routes/tasks.js', code);
