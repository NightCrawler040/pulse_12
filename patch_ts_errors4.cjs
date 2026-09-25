const fs = require('fs');

let ctxCode = fs.readFileSync('src/context/TaskContext.tsx', 'utf8');

if (!ctxCode.includes('const updateHrOrder =')) {
  ctxCode = ctxCode.replace(/const deleteFinding = \(id: string\) => \{/, 
    `const updateHrOrder = (id: string, updates: Partial<HrOrder>) => {
    setHrOrders(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
    fetch(\`/api/hr-orders/\${id}\`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${localStorage.getItem('pulse_api_token')}\` },
      body: JSON.stringify(updates)
    }).catch(console.error);
  };

  const deleteFinding = (id: string) => {`);
}

fs.writeFileSync('src/context/TaskContext.tsx', ctxCode);
