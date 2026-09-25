const fs = require('fs');

// 1. Fix AdminPanel types
let ap = fs.readFileSync('src/components/AdminPanel/AdminPanel.tsx', 'utf8');

ap = ap.replace(/useState<'workspaces' \| 'users' \| 'groups' \| 'integrations' \| 'ldap' \| 'mail' \| 'fortigate' \| 'appearance'>/, 
  "useState<'workspaces' | 'users' | 'groups' | 'integrations' | 'ldap' | 'mail' | 'fortigate' | 'appearance' | 'hr-orders'>");

if (!ap.includes('import HrOrdersSettingsTab')) {
  ap = ap.replace(/import FortigateSettingsTab from '\.\/FortigateSettingsTab';/, 
    "import FortigateSettingsTab from './FortigateSettingsTab';\nimport HrOrdersSettingsTab from './HrOrdersSettingsTab';");
}

fs.writeFileSync('src/components/AdminPanel/AdminPanel.tsx', ap);

// 2. Fix HrOrdersSettingsTab unused import
let hrTab = fs.readFileSync('src/components/AdminPanel/HrOrdersSettingsTab.tsx', 'utf8');
hrTab = hrTab.replace(/import \{ apiService \} from '\.\.\/\.\.\/services\/api';\r?\n/, "");
fs.writeFileSync('src/components/AdminPanel/HrOrdersSettingsTab.tsx', hrTab);
