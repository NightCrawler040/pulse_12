const fs = require('fs');

let code = fs.readFileSync('src/context/TaskContext.tsx', 'utf8');

const regex = /const addNotification = \(notifData: Omit<NotificationItem, 'id' \| 'createdAt' \| 'read'>\) => \{[\s\S]*?id: `notif-\$\{Date\.now\(\)\}-\$\{Math\.random\(\)\.toString\(36\)\.substr\(2, 4\)\}`,/;

const replacement = `const addNotification = (notifData: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>) => {
    const newNotif: NotificationItem = {
      workspaceId: activeWorkspaceId || undefined,
      ...notifData,
      id: \`notif-\${Date.now()}-\${Math.random().toString(36).substr(2, 4)}\`,`;

code = code.replace(regex, replacement);

fs.writeFileSync('src/context/TaskContext.tsx', code);
