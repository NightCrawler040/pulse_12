const fs = require('fs');

let code = fs.readFileSync('server/index.js', 'utf8');

if (!code.includes('import hrOrdersRouter')) {
  code = code.replace(/import apiKeysRouter from '\.\/routes\/apiKeys\.js';/, 
    "import apiKeysRouter from './routes/apiKeys.js';\nimport hrOrdersRouter from './routes/hrOrders.js';");
  
  code = code.replace(/app\.use\('\/api\/api-keys', apiKeysRouter\);/, 
    "app.use('/api/api-keys', apiKeysRouter);\napp.use('/api/hr-orders', hrOrdersRouter);");
    
  fs.writeFileSync('server/index.js', code);
}
