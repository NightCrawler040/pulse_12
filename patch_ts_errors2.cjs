const fs = require('fs');

let ctxCode = fs.readFileSync('src/context/TaskContext.tsx', 'utf8');

// Remove HrSettings from import
ctxCode = ctxCode.replace(/,\s*HrSettings/, "");

// Insert into Provider value
const hook = "      apiKeys,\n";
const replace = "      apiKeys,\n      hrOrders,\n      updateHrOrder,\n";

ctxCode = ctxCode.replace(hook, replace);

fs.writeFileSync('src/context/TaskContext.tsx', ctxCode);
