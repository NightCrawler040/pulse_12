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
  req.dbData.workspaces = req.dbData.workspaces.filter(w => w.id !== id);
  
  try { await req.broadcastUpdate('workspaces'); } catch (e) { return res.status(500).json({error: 'Database save failed'}); }
  res.json({ success: true });
});

  return router;
}
