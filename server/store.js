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
    dbData.tasks.forEach(t => { if (!t.workspaceId) t.workspaceId = 'WS-1'; if (!Array.isArray(t.comments)) t.comments = []; if (!Array.isArray(t.subtasks)) t.subtasks = []; if (!Array.isArray(t.tags)) t.tags = []; if (!Array.isArray(t.attachments)) t.attachments = []; });
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
    dbData.groups.forEach(g => { if (!g.workspaceId) g.workspaceId = 'WS-1'; if (!Array.isArray(g.memberIds)) g.memberIds = []; });
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
  };const sanitizeLdapSettings = (settings) => {
    if (!settings || typeof settings !== 'object') return {};
    return {
      ...settings,
      bindPassword: settings.bindPassword ? '********' : ''
    };
  };

  return {
    ...dbData,
    users: sanitizeUsers(dbData.users),
    hr_orders: dbData.hr_orders || [],
    hrSettings: dbData.hrSettings || {},
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
  if (!user) {
    // Unauthenticated users get ONLY safe public data
    return {
      tasks: [], findings: [], sprints: [], groups: [], hr_orders: [],
      users: data.users.map(u => ({ id: u.id, name: u.name, department: u.department })),
      api_keys: [], notifications: [], bannedIps: [], kataHashes: []
    };
  }
  if (user.roleType === 'admin') {
    return data;
  }
  const userWorkspaces = user.workspaceIds || [];
  // strict isolation: only tasks matching workspaces (no fallback for unassigned/orphaned)
  const filteredTasks = (data.tasks || []).filter(t => userWorkspaces.includes(t.workspaceId));
  const filteredFindings = (data.findings || []).filter(f => userWorkspaces.includes(f.workspaceId));
  const filteredSprints = (data.sprints || []).filter(s => userWorkspaces.includes(s.workspaceId));
  const filteredGroups = (data.groups || []).filter(g => userWorkspaces.includes(g.workspaceId));
  const filteredHrOrders = (data.hr_orders || []).filter(o => userWorkspaces.includes(o.workspaceId));
  
  const filteredWorkspaces = (data.workspaces || []).filter(w => userWorkspaces.includes(w.id));
  const filteredUsers = (data.users || []).filter(u => 
    u.roleType === 'admin' || 
    (u.workspaceIds || []).some(wid => userWorkspaces.includes(wid)) || 
    u.id === user.id
  );
  
  return { 
    ...data, 
    tasks: filteredTasks, 
    findings: filteredFindings, 
    sprints: filteredSprints, 
    groups: filteredGroups, 
    hr_orders: filteredHrOrders,
    workspaces: filteredWorkspaces,
    users: filteredUsers
  };
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
        if (socket.userId && socket.userVerified) {
          const u = dbData.users.find(usr => usr.id === socket.userId);
          if (u) {
            socket.emit('data-updated', getSanitizedDbDataForUser(u));
          }
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
