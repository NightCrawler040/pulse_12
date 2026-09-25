const fs = require('fs');

let ctxCode = fs.readFileSync('src/context/TaskContext.tsx', 'utf8');

// The line is: "        apiKeys,\n"
ctxCode = ctxCode.replace(/\s+apiKeys,/, "\n      apiKeys,\n      hrOrders,\n      updateHrOrder,");

fs.writeFileSync('src/context/TaskContext.tsx', ctxCode);
