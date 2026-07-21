import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { Task, User, Column, Sprint, FilterState, ViewMode, Status, Comment, Group, NotificationItem, ExternalFinding, ApiKeySettings } from '../types';
import { mockUsers, mockColumns, mockSprints, mockTasks } from '../data/mockData';
import { apiService, getSocket } from '../services/api';

interface TaskContextType {
  tasks: Task[];
  users: User[];
  groups: Group[];
  onlineUserIds: string[];
  notifications: NotificationItem[];
  columns: Column[];
  sprints: Sprint[];
  activeSprintId: string;
  filters: FilterState;
  viewMode: ViewMode;
  theme: 'dark' | 'light';
  filteredTasks: Task[];
  activeTaskModalId: string | null;
  isServerConnected: boolean;
  isNetworkModalOpen: boolean;
  setIsNetworkModalOpen: (open: boolean) => void;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  setViewMode: (mode: ViewMode) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setActiveTaskModalId: (id: string | null) => void;
  setActiveSprintId: (id: string) => void;
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'comments'>) => Task;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTask: (taskId: string, newStatus: Status) => void;
  addComment: (taskId: string, text: string, userId: string) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  addUser: (user: Omit<User, 'id'>) => User;
  updateUser: (id: string, updates: Partial<User>) => void;
  deleteUser: (id: string, permanent?: boolean) => void;
  addGroup: (group: Omit<Group, 'id'>) => Group;
  updateGroup: (id: string, updates: Partial<Group>) => void;
  deleteGroup: (id: string) => void;
  addSprint: (sprint: Omit<Sprint, 'id'>) => Sprint;
  updateSprint: (id: string, updates: Partial<Sprint>) => void;
  deleteSprint: (id: string) => void;
  addNotification: (notif: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAllNotifications: () => void;
  findings: ExternalFinding[];
  apiKeys: ApiKeySettings[];
  addFinding: (finding: Omit<ExternalFinding, 'id' | 'createdAt'>) => ExternalFinding;
  updateFindingStatus: (id: string, status: ExternalFinding['status'], promotedTaskId?: string) => void;
  deleteFinding: (id: string) => void;
  promoteFindingToTask: (id: string, assigneeId?: string, sprintId?: string, priority?: string) => Promise<any>;
  addApiKey: (name: string, source?: string, allowedDepartments?: string[]) => Promise<ApiKeySettings>;
  deleteApiKey: (id: string) => void;
  resetToDefault: () => void;
  exportData: () => void;
  importData: (jsonData: string) => boolean;
}

const STORAGE_KEY = 'korpjira-flowspace-state-v1';
const USERS_STORAGE_KEY = 'korpjira-users-state-v1';
const THEME_KEY = 'korpjira-theme';

const defaultFilters: FilterState = {
  search: '',
  assigneeId: null,
  priority: 'all',
  tag: 'all',
  sprintId: 'all',
  myTasksOnly: true
};

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const TaskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.tasks || mockTasks;
      } catch (e) {
        console.error('Error loading tasks from localStorage', e);
      }
    }
    return mockTasks;
  });

  const deduplicateUsers = (list: User[]): User[] => {
    if (!Array.isArray(list)) return [];
    const map = new Map<string, User>();
    list.forEach(u => {
      const k = u.id || u.login;
      if (k) map.set(k, { ...map.get(k), ...u });
    });
    return Array.from(map.values());
  };

  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem(USERS_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return deduplicateUsers(parsed);
      } catch (e) {
        console.error('Error loading users from localStorage', e);
      }
    }
    return deduplicateUsers(mockUsers);
  });
  const [columns] = useState<Column[]>(mockColumns);
  const [sprints, setSprints] = useState<Sprint[]>(mockSprints);
  const [groups, setGroups] = useState<Group[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    try {
      const saved = localStorage.getItem('korpjira-notifications');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [isNetworkModalOpen, setIsNetworkModalOpen] = useState<boolean>(false);
  const [findings, setFindings] = useState<ExternalFinding[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeySettings[]>([]);
  const [activeSprintId, setActiveSprintId] = useState<string>('all');
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    const path = window.location.pathname.replace(/^\//, '').toLowerCase();
    const validModes: ViewMode[] = ['board', 'backlog', 'workload', 'analytics', 'profile', 'admin'];
    if (validModes.includes(path as ViewMode)) {
      return path as ViewMode;
    }
    return 'board';
  });

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    const path = mode === 'board' ? '/' : `/${mode}`;
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.replace(/^\//, '').toLowerCase();
      const validModes: ViewMode[] = ['board', 'backlog', 'workload', 'analytics', 'profile', 'admin'];
      if (validModes.includes(path as ViewMode)) {
        setViewModeState(path as ViewMode);
      } else {
        setViewModeState('board');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [activeTaskModalId, setActiveTaskModalId] = useState<string | null>(null);
  const [isServerConnected, setIsServerConnected] = useState<boolean>(false);
  const [socketVersion, setSocketVersion] = useState<number>(0);

  useEffect(() => {
    const handleUrlChange = () => setSocketVersion(v => v + 1);
    window.addEventListener('socket-url-changed', handleUrlChange);
    return () => window.removeEventListener('socket-url-changed', handleUrlChange);
  }, []);
  
  const [theme, setThemeState] = useState<'dark' | 'light'>(() => {
    const savedTheme = localStorage.getItem(THEME_KEY) as 'dark' | 'light';
    return savedTheme || 'dark';
  });

  const setTheme = (newTheme: 'dark' | 'light') => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_KEY, newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Connect to backend server and setup WebSockets
  useEffect(() => {
    apiService.fetchData().then(data => {
      if (data && Array.isArray(data.tasks)) {
        setTasks(data.tasks);
        if (Array.isArray(data.sprints)) setSprints(data.sprints);
        if (Array.isArray(data.users)) setUsers(deduplicateUsers(data.users));
        if (Array.isArray(data.groups)) setGroups(data.groups);
        if (Array.isArray(data.notifications)) setNotifications(data.notifications);
        if (Array.isArray(data.findings)) setFindings(data.findings);
        if (Array.isArray(data.api_keys)) setApiKeys(data.api_keys);
        setIsServerConnected(true);
      }
    }).catch(() => {
      console.warn('⚠️ Central server unreachable, running in offline/localStorage mode');
      setIsServerConnected(false);
    });

    const socket = getSocket();
    if (socket.connected) {
      setIsServerConnected(true);
    }
    const onConnect = () => setIsServerConnected(true);
    const onDisconnect = () => setIsServerConnected(false);
    const onDataUpdated = (data: any) => {
      console.log('⚡ Real-time update received from server!', data);
      if (data && Array.isArray(data.tasks)) {
        setTasks(data.tasks);
        if (Array.isArray(data.sprints)) setSprints(data.sprints);
        if (Array.isArray(data.users)) setUsers(deduplicateUsers(data.users));
        if (Array.isArray(data.groups)) setGroups(data.groups);
        if (Array.isArray(data.notifications)) setNotifications(data.notifications);
        if (Array.isArray(data.findings)) setFindings(data.findings);
        if (Array.isArray(data.api_keys)) setApiKeys(data.api_keys);
      }
    };
    const onOnlineUsersUpdated = (ids: any) => {
      if (Array.isArray(ids)) {
        setOnlineUserIds(ids);
      }
    };
    const onNotificationReceived = (notif: any) => {
      if (notif && notif.id) {
        setNotifications(prev => [notif, ...prev.filter(n => n.id !== notif.id)]);
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('init-data', onDataUpdated);
    socket.on('data-updated', onDataUpdated);
    socket.on('online-users-updated', onOnlineUsersUpdated);
    socket.on('notification-received', onNotificationReceived);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('init-data', onDataUpdated);
      socket.off('data-updated', onDataUpdated);
      socket.off('online-users-updated', onOnlineUsersUpdated);
      socket.off('notification-received', onNotificationReceived);
    };
  }, [socketVersion]);

  // Save to LocalStorage as offline backup
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks, sprints }));
  }, [tasks, sprints]);

  useEffect(() => {
    console.log('👥 [TaskContext] Users array updated. Deduplicated total:', users.length);
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('korpjira-notifications', JSON.stringify(notifications));
  }, [notifications]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (filters.sprintId !== 'all' && task.sprintId !== filters.sprintId) {
        return false;
      }
      if (filters.assigneeId && task.assigneeId !== filters.assigneeId) {
        return false;
      }
      if (filters.priority !== 'all' && task.priority !== filters.priority) {
        return false;
      }
      if (filters.tag !== 'all' && !task.tags.includes(filters.tag)) {
        return false;
      }
      if (filters.search.trim()) {
        const query = filters.search.toLowerCase();
        const matchTitle = task.title.toLowerCase().includes(query);
        const matchDesc = task.description.toLowerCase().includes(query);
        const matchId = task.id.toLowerCase().includes(query);
        const matchTag = task.tags.some(t => t.toLowerCase().includes(query));
        if (!matchTitle && !matchDesc && !matchId && !matchTag) {
          return false;
        }
      }
      return true;
    });
  }, [tasks, filters]);

  const addNotification = (notifData: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>) => {
    const newNotif: NotificationItem = {
      ...notifData,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString(),
      read: false
    };
    setNotifications(prev => [newNotif, ...prev]);
    try {
      const socket = getSocket();
      socket.emit('send-notification', newNotif);
    } catch (e) {
      console.error('Socket notification emit error:', e);
    }
  };

  const addTask = (newTaskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'comments'>) => {
    const newId = `NEX-${Math.floor(100 + Math.random() * 900)}`;
    const now = new Date().toISOString();
    const newTask: Task = {
      ...newTaskData,
      id: newId,
      createdAt: now,
      updatedAt: now,
      comments: []
    };
    setTasks(prev => [newTask, ...prev]);
    apiService.createTask(newTask).catch(e => console.error(e));

    if (newTaskData.assigneeId && newTaskData.assigneeId !== 'unassigned') {
      addNotification({
        userId: newTaskData.assigneeId,
        title: '🆕 Новая задача назначена на вас',
        message: `Создана задача: "${newTaskData.title}" (${newId})`,
        creatorName: newTaskData.creatorName || getActor()?.name || 'Администратор',
        dueDate: newTaskData.dueDate || '',
        linkTaskId: newId,
        type: 'task_assigned'
      } as any);
    } else if (newTaskData.assigneeGroupId) {
      const targetGroup = groups.find(g => g.id === newTaskData.assigneeGroupId);
      if (targetGroup && targetGroup.memberIds) {
        targetGroup.memberIds.forEach(mId => {
          addNotification({
            userId: mId,
            title: `🆕 Новая задача для группы "${targetGroup.name}"`,
            message: `Создана задача: "${newTaskData.title}" (${newId})`,
            creatorName: newTaskData.creatorName || getActor()?.name || 'Администратор',
            dueDate: newTaskData.dueDate || '',
            linkTaskId: newId,
            type: 'task_assigned'
          } as any);
        });
      }
    }

    return newTask;
  };

  const getActor = () => {
    try {
      const actorId = localStorage.getItem('korpjira-flowspace-auth-v1');
      if (actorId) {
        const u = users.find(user => user.id === actorId);
        if (u) return u;
      }
    } catch {}
    return users[0] || { id: 'sys', name: 'Сотрудник' };
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    const oldTask = tasks.find(t => t.id === id);
    const actor = getActor();
    const auditComments: Comment[] = [];

    if (oldTask) {
      if (updates.status && updates.status !== oldTask.status) {
        const oldCol = columns.find(c => c.id === oldTask.status)?.title || oldTask.status;
        const newCol = columns.find(c => c.id === updates.status)?.title || updates.status;
        auditComments.push({
          id: `com-log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          userId: actor.id,
          text: `⚡ [Аудит]: ${actor.name} перевел(а) статус задачи из «${oldCol}» в «${newCol}»`,
          createdAt: new Date().toISOString(),
          isSystemLog: true
        });

        const involvedIds = new Set<string>();
        if (oldTask.assigneeId && oldTask.assigneeId !== 'unassigned') involvedIds.add(oldTask.assigneeId);
        if (oldTask.assigneeGroupId) {
          const grp = groups.find(g => g.id === oldTask.assigneeGroupId);
          if (grp && grp.memberIds) grp.memberIds.forEach(mId => involvedIds.add(mId));
        }
        (oldTask.comments || []).forEach(c => { if (c.userId) involvedIds.add(c.userId); });

        involvedIds.forEach(targetId => {
          if (targetId !== actor.id) {
            addNotification({
              userId: targetId,
              title: '🔄 Изменился статус задачи',
              message: `${actor.name} перевел(а) задачу "${oldTask.title}" в статус "${newCol}"`,
              linkTaskId: id,
              type: 'status_changed'
            });
          }
        });
      }

      if (updates.assigneeId !== undefined && updates.assigneeId !== oldTask.assigneeId) {
        const newAssignee = users.find(u => u.id === updates.assigneeId);
        const assigneeName = newAssignee ? newAssignee.name : 'Не назначен';
        auditComments.push({
          id: `com-log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          userId: actor.id,
          text: `👤 [Аудит]: Исполнитель изменен на: ${assigneeName}`,
          createdAt: new Date().toISOString(),
          isSystemLog: true
        });

        if (updates.assigneeId && updates.assigneeId !== 'unassigned' && updates.assigneeId !== actor.id) {
          addNotification({
            userId: updates.assigneeId,
            title: '🎯 Вам назначена задача',
            message: `${actor.name} назначил(а) вас исполнителем в задаче "${oldTask.title}" (${id})`,
            linkTaskId: id,
            type: 'task_assigned'
          });
        }
      }

      if (updates.assigneeGroupId !== undefined && updates.assigneeGroupId !== oldTask.assigneeGroupId) {
        const newGrp = groups.find(g => g.id === updates.assigneeGroupId);
        const grpName = newGrp ? newGrp.name : 'Без команды';
        auditComments.push({
          id: `com-log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          userId: actor.id,
          text: `🏢 [Аудит]: Команда задачи изменена на: ${grpName}`,
          createdAt: new Date().toISOString(),
          isSystemLog: true
        });

        if (newGrp && newGrp.memberIds) {
          newGrp.memberIds.forEach(mId => {
            if (mId !== actor.id) {
              addNotification({
                userId: mId,
                title: `🎯 Новая задача для команды "${newGrp.name}"`,
                message: `${actor.name} назначил(а) вашу команду на задачу "${oldTask.title}" (${id})`,
                linkTaskId: id,
                type: 'task_assigned'
              });
            }
          });
        }
      }

      if (updates.priority && updates.priority !== oldTask.priority) {
        auditComments.push({
          id: `com-log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          userId: actor.id,
          text: `🔥 [Аудит]: Приоритет изменен на: ${updates.priority.toUpperCase()}`,
          createdAt: new Date().toISOString(),
          isSystemLog: true
        });
      }

      if (updates.teamReadiness && JSON.stringify(updates.teamReadiness) !== JSON.stringify(oldTask.teamReadiness)) {
        const oldReadiness = oldTask.teamReadiness || {};
        const newReadiness = updates.teamReadiness;
        Object.keys(newReadiness).forEach(mId => {
          if (!oldReadiness[mId] && newReadiness[mId]) {
            const memberUser = users.find(u => u.id === mId);
            const memberName = memberUser ? memberUser.name : 'Сотрудник';
            auditComments.push({
              id: `com-log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              userId: mId,
              text: `🤝 [Командная готовность]: ${memberName} подтвердил(а) выполнение своей части работы!`,
              createdAt: new Date().toISOString(),
              isSystemLog: true
            });
          }
        });

        const grpId = updates.assigneeGroupId || oldTask.assigneeGroupId;
        const grp = groups.find(g => g.id === grpId);
        if (grp && grp.memberIds && grp.memberIds.length > 0) {
          const allConfirmed = grp.memberIds.every(mId => newReadiness[mId] === true);
          const oldAllConfirmed = grp.memberIds.every(mId => oldReadiness[mId] === true);
          if (allConfirmed && !oldAllConfirmed) {
            auditComments.push({
              id: `com-log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              userId: actor.id,
              text: `🎉 [Командная готовность]: Все участники команды «${grp.name}» подтвердили готовность к сдаче задачи!`,
              createdAt: new Date().toISOString(),
              isSystemLog: true
            });
          }
        }
      }
    }

    const finalComments = oldTask ? [...(oldTask.comments || []), ...auditComments] : [];
    const finalUpdates = auditComments.length > 0 ? { ...updates, comments: finalComments } : updates;

    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        return { ...t, ...finalUpdates, updatedAt: new Date().toISOString() };
      }
      return t;
    }));
    apiService.updateTask(id, finalUpdates).catch(e => console.error(e));
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    if (activeTaskModalId === id) {
      setActiveTaskModalId(null);
    }
    apiService.deleteTask(id).catch(e => console.error(e));
  };

  const moveTask = (taskId: string, newStatus: Status) => {
    updateTask(taskId, { status: newStatus });
  };

  const addComment = (taskId: string, text: string, userId: string) => {
    if (!text.trim()) return;
    const newComment: Comment = {
      id: `com-${Date.now()}`,
      userId,
      text: text.trim(),
      createdAt: new Date().toISOString()
    };
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      const updatedComments = [...task.comments, newComment];
      setTasks(prev => prev.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            comments: updatedComments,
            updatedAt: new Date().toISOString()
          };
        }
        return t;
      }));
      apiService.updateTask(taskId, { comments: updatedComments }).catch(e => console.error(e));

      const involvedIds = new Set<string>();
      if (task.assigneeId && task.assigneeId !== 'unassigned' && task.assigneeId !== userId) {
        involvedIds.add(task.assigneeId);
      }
      if (task.assigneeGroupId) {
        const grp = groups.find(g => g.id === task.assigneeGroupId);
        if (grp && grp.memberIds) grp.memberIds.forEach(mId => { if (mId !== userId) involvedIds.add(mId); });
      }
      task.comments.forEach(c => {
        if (c.userId && c.userId !== userId) involvedIds.add(c.userId);
      });

      const authorName = users.find(u => u.id === userId)?.name || 'Сотрудник';
      const mentionedIds = new Set<string>();
      users.forEach(u => {
        if (u.id === userId) return;
        const mentionByName = `@${u.name.toLowerCase()}`;
        const mentionByFirstName = `@${u.name.split(' ')[0].toLowerCase()}`;
        const mentionByLogin = u.login ? `@${u.login.toLowerCase()}` : '';
        const textLow = text.toLowerCase();
        if (textLow.includes(mentionByName) || textLow.includes(mentionByFirstName) || (mentionByLogin && textLow.includes(mentionByLogin))) {
          mentionedIds.add(u.id);
          addNotification({
            userId: u.id,
            title: `🔔 VIP: Вас упомянул(а) ${authorName}!`,
            message: `В задаче "${task.title}": «${text.slice(0, 60)}»`,
            linkTaskId: taskId,
            type: 'comment_added'
          });
        }
      });

      involvedIds.forEach(targetId => {
        if (!mentionedIds.has(targetId)) {
          addNotification({
            userId: targetId,
            title: `💬 Новый комментарий от ${authorName}`,
            message: `В задаче "${task.title}": ${text.slice(0, 45)}...`,
            linkTaskId: taskId,
            type: 'comment_added'
          });
        }
      });
    }
  };

  const toggleSubtask = (taskId: string, subtaskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      const updatedSubtasks = task.subtasks.map(s => {
        if (s.id === subtaskId) {
          return { ...s, completed: !s.completed };
        }
        return s;
      });
      setTasks(prev => prev.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            subtasks: updatedSubtasks,
            updatedAt: new Date().toISOString()
          };
        }
        return t;
      }));
      apiService.updateTask(taskId, { subtasks: updatedSubtasks }).catch(e => console.error(e));
    }
  };

  const addUser = (userData: Omit<User, 'id'>): User => {
    const newId = `usr-${Date.now()}`;
    const newUser: User = {
      ...userData,
      id: newId,
      login: userData.login || userData.email?.split('@')[0] || `user_${Date.now()}`,
      password: userData.password || '',
      roleType: userData.roleType || 'member',
      pin: userData.pin || userData.password || '',
      isActive: true
    };
    setUsers(prev => [...prev, newUser]);
    apiService.createUser(userData).catch(e => console.error(e));
    return newUser;
  };

  const updateUser = (id: string, updates: Partial<User>) => {
    setUsers(prev => prev.map(u => {
      if (u.id === id) {
        return { ...u, ...updates };
      }
      return u;
    }));
    apiService.updateUser(id, updates).catch(e => console.error(e));
  };

  const deleteUser = (id: string, permanent: boolean = false) => {
    if (permanent) {
      setUsers(prev => prev.filter(u => u.id !== id));
      setGroups(prev => prev.map(g => ({
        ...g,
        memberIds: (g.memberIds || []).filter(mid => mid !== id)
      })));
      setTasks(prev => prev.map(t => {
        if (t.assigneeId === id) return { ...t, assigneeId: 'unassigned' };
        return t;
      }));
    } else {
      setUsers(prev => prev.map(u => {
        if (u.id === id) {
          return { ...u, isActive: false };
        }
        return u;
      }));
    }
    apiService.deleteUser(id, permanent).catch(e => console.error(e));
  };

  const resetToDefault = () => {
    if (window.confirm('Вы уверены, что хотите сбросить все данные к исходным демонстрационным?')) {
      setTasks(mockTasks);
      setSprints(mockSprints);
      setUsers(mockUsers);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(USERS_STORAGE_KEY);
      apiService.resetDatabase().catch(e => console.error(e));
    }
  };

  const exportData = () => {
    const dataStr = JSON.stringify({ tasks, sprints, users, exportDate: new Date().toISOString() }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `korpjira-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importData = (jsonData: string): boolean => {
    try {
      const parsed = JSON.parse(jsonData);
      if (Array.isArray(parsed.tasks)) {
        setTasks(parsed.tasks);
        if (Array.isArray(parsed.sprints)) {
          setSprints(parsed.sprints);
        }
        if (Array.isArray(parsed.users)) {
          setUsers(parsed.users);
        }
        apiService.importDatabase(parsed).catch(e => console.error(e));
        return true;
      }
    } catch (e) {
      console.error('Failed to import JSON data', e);
    }
    return false;
  };

  const addGroup = (groupData: Omit<Group, 'id'>): Group => {
    const newId = `grp-${Date.now()}`;
    const newGroup: Group = { ...groupData, id: newId };
    setGroups(prev => [...prev, newGroup]);
    apiService.createGroup(groupData).catch(err => console.error('Create group failed:', err));
    return newGroup;
  };

  const updateGroup = (id: string, updates: Partial<Group>) => {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
    apiService.updateGroup(id, updates).catch(err => console.error('Update group failed:', err));
  };

  const deleteGroup = (id: string) => {
    setGroups(prev => prev.filter(g => g.id !== id));
    apiService.deleteGroup(id).catch(err => console.error('Delete group failed:', err));
  };

  const addSprint = (sprintData: Omit<Sprint, 'id'>): Sprint => {
    const newId = `sprint-${Date.now()}`;
    const newSprint: Sprint = { ...sprintData, id: newId };
    setSprints(prev => [...prev, newSprint]);
    apiService.createSprint(sprintData).catch(err => console.error('Create sprint failed:', err));
    return newSprint;
  };

  const updateSprint = (id: string, updates: Partial<Sprint>) => {
    setSprints(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    apiService.updateSprint(id, updates).catch(err => console.error('Update sprint failed:', err));
  };

  const deleteSprint = (id: string) => {
    setSprints(prev => prev.filter(s => s.id !== id));
    setTasks(prev => prev.map(t => t.sprintId === id ? { ...t, sprintId: 'unassigned' } : t));
    apiService.deleteSprint(id).catch(err => console.error('Delete sprint failed:', err));
  };

  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    apiService.markNotificationsRead(id).catch(() => {});
    try {
      getSocket().emit('mark-notification-read', id);
    } catch (e) { console.error(e); }
  };

  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    apiService.markNotificationsRead().catch(() => {});
    try {
      getSocket().emit('mark-all-notifications-read', 'all');
    } catch (e) { console.error(e); }
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    apiService.clearNotifications(undefined, id).catch(() => {});
    try {
      getSocket().emit('delete-notification', id);
    } catch (e) { console.error(e); }
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    localStorage.removeItem('korpjira-notifications');
    apiService.clearNotifications('all').catch(() => {});
    try {
      getSocket().emit('clear-user-notifications', 'all');
    } catch (e) { console.error(e); }
  };

    return (
    <TaskContext.Provider value={{
      tasks,
      users,
      groups,
      onlineUserIds,
      notifications,
      findings,
      apiKeys,
      columns,
      sprints,
      activeSprintId,
      filters,
      viewMode,
      theme,
      filteredTasks,
      activeTaskModalId,
      isServerConnected,
      isNetworkModalOpen,
      setIsNetworkModalOpen,
      setFilters,
      setViewMode,
      setTheme,
      setActiveTaskModalId,
      setActiveSprintId,
      addTask,
      updateTask,
      deleteTask,
      moveTask,
      addComment,
      toggleSubtask,
      addUser,
      updateUser,
      deleteUser,
      addGroup,
      updateGroup,
      deleteGroup,
      addSprint,
      updateSprint,
      deleteSprint,
      addNotification,
      markNotificationRead,
      markAllNotificationsRead,
      deleteNotification,
      clearAllNotifications,
      addFinding: (findingData) => {
        const newId = `fnd-${Date.now()}`;
        const newFinding: ExternalFinding = { ...findingData, id: newId, createdAt: new Date().toISOString() };
        setFindings(prev => [newFinding, ...prev]);
        apiService.createFinding(findingData).catch(e => console.error(e));
        return newFinding;
      },
      updateFindingStatus: (id, status, promotedTaskId) => {
        setFindings(prev => prev.map(f => f.id === id ? { ...f, status, promotedTaskId: promotedTaskId || f.promotedTaskId } : f));
        apiService.updateFindingStatus(id, { status, promotedTaskId }).catch(e => console.error(e));
      },
      deleteFinding: (id) => {
        setFindings(prev => prev.filter(f => f.id !== id));
        apiService.deleteFinding(id).catch(e => console.error(e));
      },
      promoteFindingToTask: async (id, assigneeId, sprintId, priority) => {
        try {
          const res = await apiService.promoteFindingToTask(id, assigneeId, sprintId, priority);
          if (res && res.task) {
            setTasks(prev => [res.task, ...prev]);
            setFindings(prev => prev.map(f => f.id === id ? { ...f, status: 'promoted', promotedTaskId: res.task.id } : f));
          }
          return res;
        } catch (e) {
          console.error('Failed to promote finding to task:', e);
          throw e;
        }
      },
      addApiKey: async (name, source, allowedDepartments) => {
        try {
          const res = await apiService.createApiKey(name, source, allowedDepartments);
          if (res) {
            setApiKeys(prev => [...prev, res]);
          }
          return res;
        } catch (e) {
          console.error('Failed to create API key:', e);
          throw e;
        }
      },
      deleteApiKey: (id) => {
        setApiKeys(prev => prev.filter(k => k.id !== id));
        apiService.deleteApiKey(id).catch(e => console.error(e));
      },
      resetToDefault,
      exportData,
      importData
    }}>
      {children}
    </TaskContext.Provider>
  );
};

export const useTaskContext = () => {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTaskContext must be used within a TaskProvider');
  }
  return context;
};
