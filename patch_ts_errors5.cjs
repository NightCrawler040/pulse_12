const fs = require('fs');
let ctxCode = fs.readFileSync('src/context/TaskContext.tsx', 'utf8');

const hook = "      hrOrders,\n      updateHrOrder,\n";
const replace = `      hrOrders,
      updateHrOrder: (id, updates) => {
        setHrOrders(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
        apiService.put(\`/api/hr-orders/\${id}\`, updates).catch(console.error);
      },
`;

ctxCode = ctxCode.replace(hook, replace);

fs.writeFileSync('src/context/TaskContext.tsx', ctxCode);
