import express from 'express';

export default function createRouter(requireAuth, requireAdmin) {
  const router = express.Router();

  router.get('/', requireAuth, async (req, res) => {
  res.json(req.dbData.groups || []);
});

  router.post('/', requireAdmin, async (req, res) => {
  const groupData = req.body;
  const newId = `grp-${Date.now()}`;
  const newGroup = {
    ...groupData,
    id: newId,
    memberIds: groupData.memberIds || []
  };
  if (!req.dbData.groups) req.dbData.groups = [];
  req.dbData.groups.push(newGroup);
  try { await req.broadcastUpdate('groups'); } catch (e) { return res.status(500).json({error: 'Database save failed'}); }
  res.status(201).json(newGroup);
});

  router.put('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  if (!req.dbData.groups) req.dbData.groups = [];
  req.dbData.groups = req.dbData.groups.map(g => {
    if (g.id === id) {
      return { ...g, ...updates };
    }
    return g;
  });
  try { await req.broadcastUpdate('groups'); } catch (e) { return res.status(500).json({error: 'Database save failed'}); }
  res.json({ success: true });
});

  router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (!req.dbData.groups) req.dbData.groups = [];
  req.dbData.groups = req.dbData.groups.filter(g => g.id !== id);
  try { await req.broadcastUpdate('groups'); } catch (e) { return res.status(500).json({error: 'Database save failed'}); }
  res.json({ success: true });
});

  return router;
}
