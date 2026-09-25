import express from 'express';
import { requireWorkspaceAccess } from '../middlewares/workspace.js';

export default function createRouter(requireAuth, requireAdmin) {
  const router = express.Router();

  router.get('/', requireAuth, requireWorkspaceAccess, async (req, res) => {
    let items = req.dbData.groups || [];
    if (req.currentUser.roleType !== 'admin') {
      const wsIds = req.currentUser.workspaceIds || [];
      items = items.filter(t => !t.workspaceId || wsIds.includes(t.workspaceId));
    }
    res.json(items);
  });

  router.post('/', requireAdmin, requireWorkspaceAccess, async (req, res) => {
  const groupData = req.body;
  if (req.body.workspaceId && req.currentUser && req.currentUser.roleType !== 'admin') {
    if (!(req.currentUser.workspaceIds || []).includes(req.body.workspaceId)) {
      return res.status(403).json({ error: 'Нет доступа к указанному workspace' });
    }
  }
  if (!req.body.workspaceId && req.currentUser && req.currentUser.workspaceIds && req.currentUser.workspaceIds.length > 0) {
      req.body.workspaceId = req.currentUser.workspaceIds[0];
    }
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

  router.put('/:id', requireAdmin, requireWorkspaceAccess, async (req, res) => {
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

  router.delete('/:id', requireAdmin, requireWorkspaceAccess, async (req, res) => {
  const { id } = req.params;
  if (!req.dbData.groups) req.dbData.groups = [];
  req.dbData.groups = req.dbData.groups.filter(g => g.id !== id);
  try { await req.broadcastUpdate('groups'); } catch (e) { return res.status(500).json({error: 'Database save failed'}); }
  res.json({ success: true });
});

  return router;
}
