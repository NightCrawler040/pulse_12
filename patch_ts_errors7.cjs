const fs = require('fs');
let c = fs.readFileSync('src/context/TaskContext.tsx', 'utf8');

c = c.replace(/      hrOrders,\s+updateHrOrder,/, 
`      hrOrders,
      updateHrOrder: (id, updates) => {
        setHrOrders(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
        fetch(\`/api/hr-orders/\${id}\`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${localStorage.getItem('pulse_api_token')}\` },
          body: JSON.stringify(updates)
        }).catch(console.error);
      },`);

fs.writeFileSync('src/context/TaskContext.tsx', c);
