import express from 'express';
import { requireWorkspaceAccess } from '../middlewares/workspace.js';

// NOTE: requireAuth is passed as a parameter to avoid breaking the current index.js monolithic structure
export default function createTasksRouter(requireAuth) {
  const router = express.Router();

  // Get all tasks
  router.get('/', requireAuth, requireWorkspaceAccess, async (req, res) => {
    let tasks = req.dbData.tasks || [];
    if (req.currentUser.roleType !== 'admin') {
      const wsIds = req.currentUser.workspaceIds || [];
      tasks = tasks.filter(t => !t.workspaceId || wsIds.includes(t.workspaceId));
    }
    res.json(tasks);
  });

  // Create new task
  router.post('/', requireAuth, requireWorkspaceAccess, async (req, res) => {
    const newTaskData = req.body;
    if (!req.body.workspaceId && req.currentUser && req.currentUser.workspaceIds && req.currentUser.workspaceIds.length > 0) {
      req.body.workspaceId = req.currentUser.workspaceIds[0];
    }
    const newId = newTaskData.id || `NEX-${Math.floor(100 + Math.random() * 900)}`;
    const now = new Date().toISOString();
    const safeComments = Array.isArray(newTaskData.comments) 
      ? newTaskData.comments.map(c => ({ ...c, userId: req.currentUser ? req.currentUser.id : c.userId }))
      : [];
    let wsId = newTaskData.workspaceId;
    if (wsId && req.currentUser && req.currentUser.roleType !== 'admin') {
      if (!(req.currentUser.workspaceIds || []).includes(wsId)) {
        return res.status(403).json({ error: 'Нет доступа к указанному workspace' });
      }
    }

    if (!wsId && req.currentUser) {
      wsId = (req.currentUser.workspaceIds && req.currentUser.workspaceIds.length > 0) ? 
      req.currentUser.workspaceIds[0] : 'WS-1';
    }
    const newTask = {
      ...newTaskData,
      id: newId,
      createdAt: now,
      updatedAt: now,
      comments: safeComments,
      workspaceId: wsId
    };
    req.dbData.tasks.unshift(newTask);
    try { 
      await req.broadcastUpdate('tasks'); 
    } catch (e) { 
      return res.status(500).json({error: 'Database save failed'}); 
    }
    res.status(201).json(newTask);
  });

  // Update task
  router.put('/:id', requireAuth, requireWorkspaceAccess, async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    
    const existingTask = (req.dbData.tasks || []).find(t => t.id === id);
    if (!existingTask) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }
    if (req.currentUser.roleType !== 'admin') {
      if (existingTask.workspaceId && !(req.currentUser.workspaceIds || []).includes(existingTask.workspaceId)) {
        return res.status(403).json({ error: 'Нет доступа к редактированию задачи из этого workspace' });
      }
    }

    // IDOR Protection: Aligned with frontend AuthContext logic
    const isManagerOrAdmin = req.currentUser?.roleType === 'admin' || req.currentUser?.role === 'admin' || req.currentUser?.roleType === 'manager';
    const isCreatorOrAssignee = existingTask.creatorId === req.currentUser?.id || existingTask.assigneeId === req.currentUser?.id;
    const isUnassigned = !existingTask.assigneeId;
    const isGroupMember = existingTask.assigneeGroupId && Array.isArray(req.dbData.groups) && 
      req.dbData.groups.some(g => g.id === existingTask.assigneeGroupId && (g.memberIds || []).includes(req.currentUser?.id));

    if (!isManagerOrAdmin && !isCreatorOrAssignee && !isUnassigned && !isGroupMember) {
      return res.status(403).json({ error: 'Доступ закрыт: вы не являетесь автором, исполнителем или участником группы' });
    }

    let found = false;
    req.dbData.tasks = req.dbData.tasks.map(t => {
      if (t.id === id) {
        found = true;
        let safeUpdates = { ...updates };
        if (safeUpdates.comments && Array.isArray(safeUpdates.comments)) {
          // Smart Merge
          const currentCommentsMap = new Map((t.comments || []).map(c => [c.id, c]));
          safeUpdates.comments.forEach(c => {
            if (!currentCommentsMap.has(c.id)) {
              currentCommentsMap.set(c.id, { ...c, userId: req.currentUser ? req.currentUser.id : c.userId });
            }
          });
          safeUpdates.comments = Array.from(currentCommentsMap.values());
          safeUpdates.comments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        }

        // Subtasks smart merge
        if (safeUpdates.subtasks && Array.isArray(safeUpdates.subtasks)) {
          const currentSubtasksMap = new Map((t.subtasks || []).map(s => [s.id, s]));
          safeUpdates.subtasks.forEach(s => {
            if (currentSubtasksMap.has(s.id)) {
              currentSubtasksMap.set(s.id, { ...currentSubtasksMap.get(s.id), ...s });
            } else {
              currentSubtasksMap.set(s.id, { ...s, completed: false });
            }
          });
          safeUpdates.subtasks = safeUpdates.subtasks.map(s => currentSubtasksMap.get(s.id)).filter(Boolean);
        }

        return { ...t, ...safeUpdates, updatedAt: new Date().toISOString() };
      }
      return t;
    });

    if (found) {
      try { 
        await req.broadcastUpdate('tasks'); 
      } catch (e) { 
        return res.status(500).json({error: 'Database save failed'}); 
      }
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Task not found' });
    }
  });

  // Delete task
  router.delete('/:id', requireAuth, requireWorkspaceAccess, async (req, res) => {
    const { id } = req.params;
    
    const existingTask = (req.dbData.tasks || []).find(t => t.id === id);
    if (existingTask) {
      if (req.currentUser.roleType !== 'admin') {
        if (existingTask.workspaceId && !(req.currentUser.workspaceIds || []).includes(existingTask.workspaceId)) {
          return res.status(403).json({ error: 'Нет доступа к удалению задачи из этого workspace' });
        }
      }
      // IDOR Protection: Only admin or creator can delete the task
      if (req.currentUser?.roleType !== 'admin' && req.currentUser?.role !== 'admin' && 
          existingTask.creatorId !== req.currentUser?.id) {
        return res.status(403).json({ error: 'Доступ закрыт: вы не можете удалить чужую задачу' });
      }
    }

    req.dbData.tasks = req.dbData.tasks.filter(t => t.id !== id);
    try { 
      await req.broadcastUpdate('tasks'); 
    } catch (e) { 
      return res.status(500).json({error: 'Database save failed'}); 
    }
    res.json({ success: true });
  });

  return router;
}
