import { getAllData, getCollection, saveCollection, saveAllData } from './db.js';

let dbData = {};
let ioInstance = null;

export const setDbData = (data) => {
  dbData = data;
};

export const getDbData = () => {
  return dbData;
};

export const setIo = (io) => {
  ioInstance = io;
};

export const getIo = () => {
  return ioInstance;
};

export const getSanitizedDbData = () => {
  // Ensure workspaces exists
  if (!dbData.workspaces || dbData.workspaces.length === 0) {
    dbData.workspaces = [
      {
        id: 'WS-1',
        name: 'Security & Engineering',
        ownerId: 'usr-1',
        adGroup: 'Engineering',
        enabledModules: ['kanban', 'security_center', 'integrations'],
        createdAt: new Date().toISOString()
      }
    ];
    saveCollection('workspaces', dbData.workspaces).catch(e => console.error('Failed to save initial workspaces', e));
  }
  
  // Migrate tasks
  if (dbData.tasks) {
    dbData.tasks.forEach(t => { if (!t.workspaceId) t.workspaceId = 'WS-1'; });
  }
  // Migrate findings
  if (dbData.findings) {
    dbData.findings.forEach(f => { if (!f.workspaceId) f.workspaceId = 'WS-1'; });
  }
  // Migrate sprints
  if (dbData.sprints) {
    dbData.sprints.forEach(s => { if (!s.workspaceId) s.workspaceId = 'WS-1'; });
  }
  // Migrate groups
  if (dbData.groups) {
    dbData.groups.forEach(g => { if (!g.workspaceId) g.workspaceId = 'WS-1'; });
  }
  
  const sanitizeUsers = (usersArray) => {
    if (!Array.isArray(usersArray)) return [];
    return usersArray.map(u => {
      const { password, pin, ...safeUser } = u;
      const fallbackName = safeUser.name || safeUser.login || safeUser.id || 'Пользователь';
      return {
        ...safeUser,
        name: fallbackName,
        role: safeUser.role || 'Специалист',
        roleType: safeUser.roleType || 'member'
      };
    });
  };

  const sanitizeLdapSettings = (settings) => {
    if (!settings || typeof settings !== 'object') return {};
    return {
      ...settings,
      bindPassword: settings.bindPassword ? '********' : ''
    };
  };

  return {
    ...dbData,
    users: sanitizeUsers(dbData.users),
    api_keys: [], // Hide API keys
    ldap_settings: sanitizeLdapSettings(dbData.ldap_settings),
    mailSettings: dbData.mailSettings || {},
    imapSettings: dbData.imapSettings ? { ...dbData.imapSettings, password: dbData.imapSettings.password ? '********' : '' } : {},
    notificationEvents: dbData.notificationEvents || {},
    fortigateSettings: {}, // Hide Fortigate settings
    bannedIps: dbData.bannedIps || [],
    kataHashes: dbData.kataHashes || []
  };
};

export const getSanitizedDbDataForUser = (user) => {
  const data = getSanitizedDbData();
  if (!user || user.roleType === 'admin') {
    return data;
  }
  const userWorkspaces = user.workspaceIds || [];
  const filteredTasks = (data.tasks || []).filter(t => !t.workspaceId || userWorkspaces.includes(t.workspaceId));
  const filteredFindings = (data.findings || []).filter(f => !f.workspaceId || userWorkspaces.includes(f.workspaceId));
  const filteredSprints = (data.sprints || []).filter(s => !s.workspaceId || userWorkspaces.includes(s.workspaceId));
  const filteredGroups = (data.groups || []).filter(g => !g.workspaceId || userWorkspaces.includes(g.workspaceId));
  return { ...data, tasks: filteredTasks, findings: filteredFindings, sprints: filteredSprints, groups: filteredGroups };
};

export const broadcastUpdate = async (key) => {
  try {
    if (key && dbData[key]) {
      await saveCollection(key, dbData[key]);
    } else {
      await saveAllData(dbData);
    }
    
    if (ioInstance) {
      // 2. ?>?? ??> ??????? ??:???? ?'??>?? WebSockets
      ioInstance.sockets.sockets.forEach(socket => {
        if (socket.userId) {
          const u = dbData.users.find(usr => usr.id === socket.userId);
          if (u) {
            socket.emit('data-updated', getSanitizedDbDataForUser(u));
          } else {
            socket.emit('data-updated', getSanitizedDbData());
          }
        } else {
          socket.emit('data-updated', getSanitizedDbData());
        }
      });
    }
  } catch (err) {
    console.error('⚠️ Ошибка записи в БД, откат данных в памяти для:', key || 'ALL');
    if (key) {
      dbData[key] = await getCollection(key);
    } else {
      dbData = await getAllData();
    }
    throw err;
  }
};
