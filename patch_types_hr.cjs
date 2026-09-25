const fs = require('fs');
let code = fs.readFileSync('src/types/index.ts', 'utf8');

const typeToAdd = `
export interface HrOrder {
  id: string;
  workspaceId: string;
  type: 'Прием' | 'Расторжение' | 'Декрет' | 'Перевод' | 'Unknown';
  fullName: string;
  date: string;
  oldPosition: string;
  newPosition: string;
  department?: string;
  period?: string;
  pcName: string;
  kaspersky: string;
  dlp: string;
  staffcop: string;
  cisco: string;
  pdfUrl?: string;
  createdAt: string;
}

export interface HrSettings {
  enabled?: boolean;
  workspaceId?: string;
  assignedGroupId?: string;
}
`;

if (!code.includes('export interface HrOrder')) {
  code += typeToAdd;
  fs.writeFileSync('src/types/index.ts', code);
}
