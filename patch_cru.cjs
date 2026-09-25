const fs = require('fs');

function patchCreateUpdate(filename) {
  let code = fs.readFileSync(filename, 'utf8');

  // Patch POST
  code = code.replace(/router\.post\('\/', (requireAuth|requireAdmin), async \(req, res\) => \{/, 
`router.post('/', $1, requireWorkspaceAccess, async (req, res) => {
  const data = req.body;
  if (data.workspaceId && req.currentUser && req.currentUser.roleType !== 'admin') {
    if (!(req.currentUser.workspaceIds || []).includes(data.workspaceId)) {
      return res.status(403).json({ error: 'Нет доступа к указанному workspace' });
    }
  }`);

  // Patch PUT
  code = code.replace(/router\.put\('\/:id', (requireAuth|requireAdmin), async \(req, res\) => \{/,
`router.put('/:id', $1, requireWorkspaceAccess, async (req, res) => {
  const { id } = req.params;
  const existing = (req.dbData[req.baseUrl.split('/').pop()] || []).find(x => x.id === id);
  if (existing && req.currentUser && req.currentUser.roleType !== 'admin') {
    if (existing.workspaceId && !(req.currentUser.workspaceIds || []).includes(existing.workspaceId)) {
      return res.status(403).json({ error: 'Нет доступа к редактированию в данном workspace' });
    }
  }`);

  // Patch DELETE
  code = code.replace(/router\.delete\('\/:id', (requireAuth|requireAdmin), async \(req, res\) => \{/,
`router.delete('/:id', $1, requireWorkspaceAccess, async (req, res) => {
  const { id } = req.params;
  const existing = (req.dbData[req.baseUrl.split('/').pop()] || []).find(x => x.id === id);
  if (existing && req.currentUser && req.currentUser.roleType !== 'admin') {
    if (existing.workspaceId && !(req.currentUser.workspaceIds || []).includes(existing.workspaceId)) {
      return res.status(403).json({ error: 'Нет доступа к удалению в данном workspace' });
    }
  }`);

  fs.writeFileSync(filename, code);
}

patchCreateUpdate('server/routes/findings.js');
patchCreateUpdate('server/routes/sprints.js');
patchCreateUpdate('server/routes/groups.js');
