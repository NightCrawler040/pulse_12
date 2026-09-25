import express from 'express';

export default function createRouter(requireAuth, requireAdmin) {
  const router = express.Router();

  router.post('/', requireAdmin, async (req, res) => {
  if (!req.body || !req.body.name || !String(req.body.name).trim()) {
    return res.status(400).json({ error: 'Имя пространства не может быть пустым' });
  }
  const newWs = {
    ...req.body,
    id: `WS-${Date.now()}`,
    createdAt: new Date().toISOString()
  };
  if (!req.dbData.workspaces) req.dbData.workspaces = [];
  req.dbData.workspaces.push(newWs);
  
  try { await req.broadcastUpdate('workspaces'); } catch (e) { return res.status(500).json({error: 'Database save failed'}); }
  res.status(201).json(newWs);
});

  router.put('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  if (updates && updates.name !== undefined && !String(updates.name).trim()) {
    return res.status(400).json({ error: 'Имя пространства не может быть пустым' });
  }
  req.dbData.workspaces = req.dbData.workspaces.map(w => w.id === id ? { ...w, ...updates } : w);
  
  try { await req.broadcastUpdate('workspaces'); } catch (e) { return res.status(500).json({error: 'Database save failed'}); }
  res.json({ success: true });
});

  router.delete('/:id', requireAdmin, async (req, res) => {
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

  req.dbData.workspaces = req.dbData.workspaces.filter(w => w.id !== id);
  
  try { await req.broadcastUpdate('workspaces'); } catch (e) { return res.status(500).json({error: 'Database save failed'}); }
  res.json({ success: true });
});

  return router;
}
