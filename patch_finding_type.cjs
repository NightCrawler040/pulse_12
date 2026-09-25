const fs = require('fs');

let code = fs.readFileSync('src/types/index.ts', 'utf8');

code = code.replace(/export interface ExternalFinding \{([\s\S]*?)createdAt: string;/g, 'export interface ExternalFinding {$1createdAt: string;\n  workspaceId?: string;');

fs.writeFileSync('src/types/index.ts', code);
