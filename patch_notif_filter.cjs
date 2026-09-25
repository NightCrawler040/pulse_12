const fs = require('fs');

let code = fs.readFileSync('src/context/TaskContext.tsx', 'utf8');

// Insert filteredNotifications
const useMemoHooks = `
  const filteredNotifications = useMemo(() => {
    if (!activeWorkspaceId) return notifications;
    return notifications.filter(n => !n.workspaceId || n.workspaceId === activeWorkspaceId);
  }, [notifications, activeWorkspaceId]);
`;

code = code.replace(/const filteredSprints = useMemo\(\(\) => \{/, useMemoHooks + '\n  const filteredSprints = useMemo(() => {');

// Override context values
code = code.replace(/onlineUserIds,\s*notifications,/, 'onlineUserIds,\n        notifications: filteredNotifications,');

fs.writeFileSync('src/context/TaskContext.tsx', code);
