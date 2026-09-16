import express from 'express';

export default function createRouter(requireAuth, requireAdmin) {
  const router = express.Router();

  router.post('/', requireAdmin, async (req, res) => {
  const sprintData = req.body;
  const newId = sprintData.id || `sprint-${Date.now()}`;
  const newSprint = {
    ...sprintData,
    id: newId,
    isActive: sprintData.isActive || false
  };
  if (!req.dbData.sprints) req.dbData.sprints = [];
  req.dbData.sprints.push(newSprint);
  try { await req.broadcastUpdate('sprints'); } catch (e) { return res.status(500).json({error: 'Database save failed'}); }
  res.status(201).json(newSprint);
});

  router.put('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  if (!req.dbData.sprints) req.dbData.sprints = [];
  req.dbData.sprints = req.dbData.sprints.map(s => {
    if (s.id === id) {
      return { ...s, ...updates };
    }
    return s;
  });
  try { await req.broadcastUpdate('sprints'); } catch (e) { return res.status(500).json({error: 'Database save failed'}); }
  res.json({ success: true });
});

  router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (!req.dbData.sprints) req.dbData.sprints = [];
  req.dbData.sprints = req.dbData.sprints.filter(s => s.id !== id);
  if (!req.dbData.tasks) req.dbData.tasks = [];
  req.dbData.tasks = req.dbData.tasks.map(t => {
    if (t.sprintId === id) {
      return { ...t, sprintId: 'unassigned' };
    }
    return t;
  });
  try { await req.broadcastUpdate('sprints'); } catch (e) { return res.status(500).json({error: 'Database save failed'}); }
  try { await req.broadcastUpdate('tasks'); } catch (e) { return res.status(500).json({error: 'Database save failed'}); }
  res.json({ success: true });
});

  return router;
}
