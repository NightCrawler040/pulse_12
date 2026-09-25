const fs = require('fs');

let ctxCode = fs.readFileSync('src/context/TaskContext.tsx', 'utf8');

// Fix import
ctxCode = ctxCode.replace(/import type \{([^}]+)ApiKeySettings\s*,\s*Workspace\s*\}/, "import type {$1ApiKeySettings, Workspace, HrOrder, HrSettings }");

// Check if HrOrder is successfully added
if (!ctxCode.includes('HrOrder, HrSettings')) {
  // alternative
  ctxCode = ctxCode.replace(/Workspace\s*\}/, "Workspace, HrOrder, HrSettings }");
}

// Add to interface TaskContextType
if (!ctxCode.includes('hrOrders: HrOrder[];')) {
  ctxCode = ctxCode.replace(/apiKeys: ApiKeySettings\[\];/, 
    "apiKeys: ApiKeySettings[];\n  hrOrders: HrOrder[];\n  updateHrOrder: (id: string, updates: Partial<HrOrder>) => void;");
}

// Add to Context Provider
if (!ctxCode.includes('hrOrders,')) {
  ctxCode = ctxCode.replace(/apiKeys,/, "apiKeys,\n      hrOrders,\n      updateHrOrder,");
}

fs.writeFileSync('src/context/TaskContext.tsx', ctxCode);

// Fix HrOrdersDashboard.tsx unused imports
let dashCode = fs.readFileSync('src/components/SecurityCenter/HrOrdersDashboard.tsx', 'utf8');
dashCode = dashCode.replace(/Download, CheckCircle, XCircle, AlertCircle, Clock, Save/, "Download, Save");
fs.writeFileSync('src/components/SecurityCenter/HrOrdersDashboard.tsx', dashCode);
