const fs = require('fs');
let code = fs.readFileSync('src/types/index.ts', 'utf8');

code = code.replace(/export interface Workspace \{([\s\S]*?)ownerId: string;/g, 'export interface Workspace {$1ownerId: string;\n  memberIds?: string[];');
code = code.replace(/export interface NotificationItem \{([\s\S]*?)userId: string;/g, 'export interface NotificationItem {$1userId: string;\n  workspaceId?: string;');

fs.writeFileSync('src/types/index.ts', code);
