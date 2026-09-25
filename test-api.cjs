const http = require('http');
const crypto = require('crypto');

const adminId = 'usr-1';
const secret = 'Pulse12_Corporate_Secure_HMAC_Key_2026';
const adminPass = '$2a$10$jm9p1H3ipWidxF9fxD3BJO4v3Da73u8wQ71jRj9yORHcfBAR/jTiO';
const adminPin = '$2a$10$IYI2V6lvFdmtqOWkBic8be.NEOzmSVQ/XZLOfDvFW6FaneTG1tXDC';
const data = `${adminId}:${adminPass}:${adminPin}:${secret}`;
const token = crypto.createHmac('sha256', secret).update(data).digest('hex');

const payload = JSON.stringify({ roleType: 'admin' });

const req = http.request({
  hostname: 'localhost',
  port: 3001,
  path: '/api/users/usr-2',
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'x-auth-user': adminId,
    'x-api-token': token,
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Body: ${body}`);
    
    http.get('http://localhost:3001/api/data', (res2) => {
      let b2 = '';
      res2.on('data', chunk => b2 += chunk);
      res2.on('end', () => {
        const db = JSON.parse(b2);
        console.log('usr-2 roleType:', db.users.find(u => u.id === 'usr-2').roleType);
      });
    });
  });
});
req.write(payload);
req.end();
