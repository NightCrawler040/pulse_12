const fs = require('fs');
let code = fs.readFileSync('server/store.js', 'utf8');

// Inside getSanitizedDbData, it returns an object. I will just replace the return block.
code = code.replace(/return \{([\s\S]*?)\};/, 
  "return {$1\n    hr_orders: dbData.hr_orders || [],\n    hrSettings: dbData.hrSettings || {},\n  };");

fs.writeFileSync('server/store.js', code);
