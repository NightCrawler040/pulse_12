import express from 'express';
import { requireWorkspaceAccess } from '../middlewares/workspace.js';

export default function createRouter(requireAuth, requireAdmin) {
  const router = express.Router();

  router.post('/', requireAdmin, requireWorkspaceAccess, async (req, res) => {
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
    isActive: sprintData.isActive || false
  };
  if (!req.dbData.sprints) req.dbData.sprints = [];
  req.dbData.sprints.push(newSprint);
  try { await req.broadcastUpdate('sprints'); } catch (e) { return res.status(500).json({error: 'Database save failed'}); }
  res.status(201).json(newSprint);
});

  router.put('/:id', requireAdmin, requireWorkspaceAccess, async (req, res) => {
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

  router.delete('/:id', requireAdmin, requireWorkspaceAccess, async (req, res) => {
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

  // === ЗАВЕРШИТЬ СПРИНТ: Архивировать + перенести незавершённые задачи ===
  router.post('/:id/complete', requireAuth, (req, res, next) => {
    const role = req.currentUser?.roleType;
    if (role !== 'admin' && role !== 'manager') {
      return res.status(403).json({ error: 'Завершать спринт могут только менеджеры и администраторы' });
    }
    next();
  }, requireWorkspaceAccess, async (req, res) => {
    const { id } = req.params;
    const { targetSprintId } = req.body || {}; // ID спринта для переноса незавершённых задач
    const isAdminUser = req.currentUser.roleType === 'admin';
    const userWs = req.currentUser.workspaceIds || [];
    const hasAccess = (s) => isAdminUser || (s && s.workspaceId && userWs.includes(s.workspaceId));
    
    if (!req.dbData.sprints) req.dbData.sprints = [];
    const sprint = req.dbData.sprints.find(s => s.id === id);
    if (!sprint) return res.status(404).json({ error: 'Спринт не найден' });
    if (!hasAccess(sprint)) return res.status(403).json({ error: 'Нет доступа к workspace этого спринта' });
    if (sprint.isArchived) return res.status(400).json({ error: 'Спринт уже завершён' });
    
    let targetSprint = null;
    if (targetSprintId) {
      targetSprint = req.dbData.sprints.find(s => s.id === targetSprintId);
      if (!targetSprint || targetSprint.id === id || targetSprint.isArchived) {
        return res.status(400).json({ error: 'Некорректный целевой спринт' });
      }
      if (!hasAccess(targetSprint) || (sprint.workspaceId && targetSprint.workspaceId !== sprint.workspaceId)) {
        return res.status(403).json({ error: 'Целевой спринт в другом workspace' });
      }
    }
    
    // 1. Архивируем спринт
    sprint.isActive = false;
    sprint.isArchived = true;
    sprint.archivedAt = new Date().toISOString();
    sprint.archivedBy = req.currentUser.id;
    
    // 2. Считаем статистику задач
    if (!req.dbData.tasks) req.dbData.tasks = [];
    const sprintTasks = req.dbData.tasks.filter(t => t.sprintId === id);
    const doneTasks = sprintTasks.filter(t => t.status === 'done');
    const incompleteTasks = sprintTasks.filter(t => t.status !== 'done');
    
    // 3. Переносим незавершённые задачи в целевой спринт
    let movedCount = 0;
    if (incompleteTasks.length > 0 && targetSprintId) {
      if (targetSprint) {
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
