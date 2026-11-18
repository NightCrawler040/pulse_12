import express from 'express';
import { requireWorkspaceAccess } from '../middlewares/workspace.js';
import { createSnapshot } from '../backup.js';

export default function createRouter(requireAuth, requireAdmin) {
  const router = express.Router();

  const canManageSprint = (req, res, next) => {
    const role = req.currentUser?.roleType;
    const isWsOwner = (req.dbData.workspaces || []).some(w => w.ownerId === req.currentUser?.id);
    if (role !== 'admin' && role !== 'manager' && !isWsOwner) {
      return res.status(403).json({ error: 'Управлять спринтами могут только администраторы и руководители пространств' });
    }
    next();
  };

  router.post('/', requireAuth, canManageSprint, requireWorkspaceAccess, async (req, res) => {
    const sprintData = req.body;
    if (req.body.workspaceId && req.currentUser && req.currentUser.roleType !== 'admin') {
      if (!(req.currentUser.workspaceIds || []).includes(req.body.workspaceId)) {
        return res.status(403).json({ error: 'Нет доступа к указанному workspace' });
      }
    }
    if (!req.body.workspaceId && req.currentUser && req.currentUser.workspaceIds && req.currentUser.workspaceIds.length > 0) {
      req.body.workspaceId = req.currentUser.workspaceIds[0];
    }
    const newId = sprintData.id || `sprint-${Date.now()}`;
    const newSprint = {
      ...sprintData,
      id: newId,
      workspaceId: req.body.workspaceId || 'WS-1',
      isActive: sprintData.isActive || false
    };
    if (!req.dbData.sprints) req.dbData.sprints = [];
    req.dbData.sprints.push(newSprint);
    try { await req.broadcastUpdate('sprints'); } catch (e) { return res.status(500).json({ error: 'Database save failed' }); }
    res.status(201).json(newSprint);
  });

  router.put('/:id', requireAuth, canManageSprint, requireWorkspaceAccess, async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    if (!req.dbData.sprints) req.dbData.sprints = [];
    req.dbData.sprints = req.dbData.sprints.map(s => {
      if (s.id === id) {
        return { ...s, ...updates };
      }
      return s;
    });
    try { await req.broadcastUpdate('sprints'); } catch (e) { return res.status(500).json({ error: 'Database save failed' }); }
    res.json({ success: true });
  });

  router.delete('/:id', requireAuth, canManageSprint, requireWorkspaceAccess, async (req, res) => {
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
    try { await req.broadcastUpdate('sprints'); } catch (e) { return res.status(500).json({ error: 'Database save failed' }); }
    try { await req.broadcastUpdate('tasks'); } catch (e) { return res.status(500).json({ error: 'Database save failed' }); }
    res.json({ success: true });
  });

  // === ЗАВЕРШИТЬ СПРИНТ: Создать бэкап спринта + Архивировать + перенести незавершённые задачи ===
  router.post('/:id/complete', requireAuth, canManageSprint, requireWorkspaceAccess, async (req, res) => {
    const { id } = req.params;
    const { targetSprintId } = req.body || {};
    const isAdminUser = req.currentUser.roleType === 'admin';
    const userWs = req.currentUser.workspaceIds || [];
    const hasAccess = (s) => isAdminUser || (s && (!s.workspaceId || userWs.includes(s.workspaceId)));
    
    if (!req.dbData.sprints) req.dbData.sprints = [];
    const sprint = req.dbData.sprints.find(s => s.id === id);
    if (!sprint) return res.status(404).json({ error: 'Спринт не найден' });
    if (!hasAccess(sprint)) return res.status(403).json({ error: 'Нет доступа к workspace этого спринта' });
    if (sprint.isArchived) return res.status(400).json({ error: 'Спринт уже завершён' });
    
    let targetSprint = null;
    if (targetSprintId && targetSprintId !== 'backlog') {
      targetSprint = req.dbData.sprints.find(s => s.id === targetSprintId);
      if (!targetSprint || targetSprint.id === id || targetSprint.isArchived) {
        return res.status(400).json({ error: 'Некорректный целевой спринт' });
      }
    }
    
    if (!req.dbData.tasks) req.dbData.tasks = [];
    const sprintTasks = req.dbData.tasks.filter(t => t.sprintId === id);
    const doneTasks = sprintTasks.filter(t => t.status === 'done');
    const incompleteTasks = sprintTasks.filter(t => t.status !== 'done');

    // 1. Создаем автоматический неизменяемый бэкап спринта на диске
    const backupFilename = await createSnapshot({
      backupType: 'sprint_archive',
      archivedAt: new Date().toISOString(),
      archivedBy: req.currentUser.id,
      sprint: { ...sprint },
      stats: {
        totalTasks: sprintTasks.length,
        completedTasks: doneTasks.length,
        incompleteTasks: incompleteTasks.length
      },
      tasks: JSON.parse(JSON.stringify(sprintTasks))
    }, `sprint_${sprint.id}`);

    // 2. Архивируем спринт
    sprint.isActive = false;
    sprint.isArchived = true;
    sprint.archivedAt = new Date().toISOString();
    sprint.archivedBy = req.currentUser.id;
    sprint.backupFilename = backupFilename;
    
    // 3. Переносим незавершённые задачи в целевой спринт или в бэклог ('unassigned')
    let movedCount = 0;
    if (incompleteTasks.length > 0) {
      if (targetSprintId === 'backlog') {
        incompleteTasks.forEach(t => {
          t.sprintId = 'unassigned';
          t.updatedAt = new Date().toISOString();
        });
        movedCount = incompleteTasks.length;
      } else if (targetSprint) {
        incompleteTasks.forEach(t => {
          t.sprintId = targetSprintId;
          t.updatedAt = new Date().toISOString();
        });
        movedCount = incompleteTasks.length;
      }
    }
    
    try { 
      await req.broadcastUpdate('sprints'); 
      await req.broadcastUpdate('tasks'); 
    } catch (e) { 
      return res.status(500).json({ error: 'Database save failed' }); 
    }
    
    res.json({ 
      success: true, 
      archived: sprint.name,
      backupFilename,
      stats: {
        total: sprintTasks.length,
        completed: doneTasks.length,
        moved: movedCount,
        targetSprintId: targetSprintId || null
      }
    });
  });

  return router;
}
