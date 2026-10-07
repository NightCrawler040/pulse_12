import { initDb, getAllData, saveAllData } from './db.js';

export const runMigration = async () => {
  await initDb();
  const dbData = await getAllData();
  let newWorkspacesAdded = false;
  
  const ensureWorkspace = (dept) => {
    const safeName = (dept || 'Отдел не указан').trim();
    if (!dbData.workspaces) dbData.workspaces = [];
    let ws = dbData.workspaces.find(w => (w.adGroup && w.adGroup.toLowerCase() === safeName.toLowerCase()) || (w.name && w.name.toLowerCase() === safeName.toLowerCase()));
    if (!ws) {
      ws = { id: 'WS-DEP-' + Date.now() + '-' + Math.floor(Math.random() * 10000), name: safeName, adGroup: safeName, createdAt: new Date().toISOString() };
      dbData.workspaces.push(ws);
      newWorkspacesAdded = true;
    }
    return ws.id;
  };

  dbData.users.forEach(u => {
    if (u.roleType !== 'admin') {
      const wsId = ensureWorkspace(u.department);
      u.workspaceIds = [wsId];
    }
  });

  if (dbData.tasks) {
    dbData.tasks.forEach(t => {
      if (!t.workspaceId || t.workspaceId === 'WS-1') {
        let targetUserId = t.creatorId || t.assigneeId;
        if (targetUserId) {
          const u = dbData.users.find(usr => usr.id === targetUserId);
          if (u && u.workspaceIds && u.workspaceIds.length > 0) {
            t.workspaceId = u.workspaceIds[0];
          } else {
            t.workspaceId = ensureWorkspace('Системный');
          }
        } else {
          t.workspaceId = ensureWorkspace('Системный');
        }
      }
    });
  }

  if (dbData.sprints) {
    dbData.sprints.forEach(s => {
      if (!s.workspaceId || s.workspaceId === 'WS-1') {
        let targetUserId = s.creatorId;
        if (targetUserId) {
          const u = dbData.users.find(usr => usr.id === targetUserId);
          if (u && u.workspaceIds && u.workspaceIds.length > 0) {
            s.workspaceId = u.workspaceIds[0];
          }
        }
      }
    });
  }

  if (dbData.groups) {
    dbData.groups.forEach(g => {
      if (!g.workspaceId || g.workspaceId === 'WS-1') {
        if (g.memberIds && g.memberIds.length > 0) {
          const u = dbData.users.find(usr => usr.id === g.memberIds[0]);
          if (u && u.workspaceIds && u.workspaceIds.length > 0) {
            g.workspaceId = u.workspaceIds[0];
          }
        }
      }
    });
  }

  await saveAllData(dbData);
  console.log('Migration successfully completed!');
  setTimeout(() => process.exit(0), 1000);
};

