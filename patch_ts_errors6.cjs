const fs = require('fs');
let ctxCode = fs.readFileSync('src/context/TaskContext.tsx', 'utf8');

const hook = "      hrOrders,\n      updateHrOrder,\n";
const replace = `      hrOrders,
      updateHrOrder: (id, updates) => {
        setHrOrders(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
        fetch(\`/api/hr-orders/\${id}\`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${localStorage.getItem('pulse_api_token')}\` },
          body: JSON.stringify(updates)
        }).catch(console.error);
      },
`;

ctxCode = ctxCode.replace(hook, replace);
fs.writeFileSync('src/context/TaskContext.tsx', ctxCode);
