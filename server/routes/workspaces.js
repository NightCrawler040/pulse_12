import express from 'express';
import { saveCollection } from '../db.js';

export default function createRouter(requireAuth, requireAdmin) {
  const router = express.Router();

  const syncUsersWithWorkspace = (dbData, ws) => {
    if (!ws || !Array.isArray(dbData.users)) return 0;
    const rawGroups = String(ws.adGroup || '')
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    let syncedCount = 0;
    dbData.users.forEach(u => {
      if (!Array.isArray(u.workspaceIds)) u.workspaceIds = ['WS-1'];
      const userDept = String(u.department || '').trim().toLowerCase();
      const isOwner = ws.ownerId && u.id === ws.ownerId;
      const matchesDept = rawGroups.length > 0 && userDept && rawGroups.some(g => userDept.includes(g) || g.includes(userDept));
      if (isOwner || matchesDept) {
        if (!u.workspaceIds.includes(ws.id)) {
          u.workspaceIds.push(ws.id);
          syncedCount++;
        }
      }
    });
    return syncedCount;
  };

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
    
    const synced = syncUsersWithWorkspace(req.dbData, newWs);
    if (synced > 0) {
      await saveCollection('users', req.dbData.users);
      await req.broadcastUpdate('users');
    }

    try { await req.broadcastUpdate('workspaces'); } catch (e) { return res.status(500).json({error: 'Database save failed'}); }
    res.status(201).json(newWs);
  });

  router.put('/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    if (updates && updates.name !== undefined && !String(updates.name).trim()) {
      return res.status(400).json({ error: 'Имя пространства не может быть пустым' });
    }
    let updatedWs = null;
    req.dbData.workspaces = req.dbData.workspaces.map(w => {
      if (w.id === id) {
        updatedWs = { ...w, ...updates };
        return updatedWs;
      }
      return w;
    });
    
    if (updatedWs) {
      const synced = syncUsersWithWorkspace(req.dbData, updatedWs);
      if (synced > 0) {
        await saveCollection('users', req.dbData.users);
        await req.broadcastUpdate('users');
      }
    }

    try { await req.broadcastUpdate('workspaces'); } catch (e) { return res.status(500).json({error: 'Database save failed'}); }
    res.json({ success: true });
  });

  router.post('/:id/sync-members', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const ws = (req.dbData.workspaces || []).find(w => w.id === id);
    if (!ws) return res.status(404).json({ error: 'Пространство не найдено' });
    const synced = syncUsersWithWorkspace(req.dbData, ws);
    await saveCollection('users', req.dbData.users);
    await req.broadcastUpdate('users');
    res.json({ success: true, syncedCount: synced });
  });

  router.delete('/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    if (id === 'WS-1') {
      return res.status(400).json({ error: 'Основное пространство WS-1 удалить нельзя' });
    }
    
    // Cascade migration to WS-1 so no tasks/sprints/findings are ever lost
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
    
    try { await req.broadcastUpdate(); } catch (e) { return res.status(500).json({error: 'Database save failed'}); }
    res.json({ success: true });
  });

  return router;
}
