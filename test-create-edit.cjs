const http = require('http');
const crypto = require('crypto');

const adminId = 'usr-1';
const secret = 'Pulse12_Corporate_Secure_HMAC_Key_2026';
const adminPass = '$2a$10$jm9p1H3ipWidxF9fxD3BJO4v3Da73u8wQ71jRj9yORHcfBAR/jTiO';
const adminPin = '$2a$10$IYI2V6lvFdmtqOWkBic8be.NEOzmSVQ/XZLOfDvFW6FaneTG1tXDC';
const data = `${adminId}:${adminPass}:${adminPin}:${secret}`;
const token = crypto.createHmac('sha256', secret).update(data).digest('hex');

const payload = JSON.stringify({ 
  name: 'New Guy', 
  login: 'newguy', 
  email: 'new@corp.lan', 
  role: 'Tester', 
  roleType: 'member' 
});

const req = http.request({
  hostname: 'localhost',
  port: 3001,
  path: '/api/users',
  method: 'POST',
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
    console.log(`CREATE Status: ${res.statusCode}`);
    console.log(`CREATE Body: ${body}`);
    const newUser = JSON.parse(body);

    const putPayload = JSON.stringify({ name: 'New Guy Edited', roleType: 'admin' });
    const req2 = http.request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/users/' + newUser.id,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-user': adminId,
        'x-api-token': token,
        'Content-Length': Buffer.byteLength(putPayload)
      }
    }, (res2) => {
      let b2 = '';
      res2.on('data', chunk => b2 += chunk);
      res2.on('end', () => {
        console.log(`PUT Status: ${res2.statusCode}`);
        console.log(`PUT Body: ${b2}`);
      });
    });
    req2.write(putPayload);
    req2.end();
  });
});
req.write(payload);
req.end();
