const fs = require('fs');
let code = fs.readFileSync('src/context/TaskContext.tsx', 'utf8');

// 1. Imports
if (!code.includes('HrOrder')) {
  code = code.replace(/ExternalFinding, ApiKeySettings, Workspace \}/, 
    "ExternalFinding, ApiKeySettings, Workspace, HrOrder, HrSettings }");
}

// 2. State definition
if (!code.includes('hrOrders: HrOrder[]')) {
  code = code.replace(/apiKeys: ApiKeySettings\[\];/, 
    "apiKeys: ApiKeySettings[];\n  hrOrders: HrOrder[];\n  updateHrOrder: (id: string, updates: Partial<HrOrder>) => void;");
}

// 3. React state
if (!code.includes('const [hrOrders, setHrOrders]')) {
  code = code.replace(/const \[apiKeys, setApiKeys\] = useState<ApiKeySettings\[\]>\(\[\]\);/, 
    "const [apiKeys, setApiKeys] = useState<ApiKeySettings[]>([]);\n  const [hrOrders, setHrOrders] = useState<HrOrder[]>([]);");
}

// 4. data-updated listener
if (!code.includes('setHrOrders(data.hr_orders')) {
  code = code.replace(/if \(data\.api_keys\) setApiKeys\(data\.api_keys\);/, 
    "if (data.api_keys) setApiKeys(data.api_keys);\n      if (data.hr_orders) setHrOrders(data.hr_orders);");
}
if (!code.includes('if (initialData.hr_orders)')) {
  code = code.replace(/if \(initialData\.api_keys\) setApiKeys\(initialData\.api_keys\);/, 
    "if (initialData.api_keys) setApiKeys(initialData.api_keys);\n        if (initialData.hr_orders) setHrOrders(initialData.hr_orders);");
}

// 5. update function
if (!code.includes('const updateHrOrder')) {
  code = code.replace(/const deleteFinding = \(id: string\) => \{/, 
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

// 6. Return values
if (!code.includes('hrOrders,')) {
  code = code.replace(/apiKeys,\n\s*addFinding,/, 
    "apiKeys,\n        hrOrders,\n        updateHrOrder,\n        addFinding,");
}

fs.writeFileSync('src/context/TaskContext.tsx', code);
