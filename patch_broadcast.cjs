const fs = require('fs');

let code = fs.readFileSync('server/index.js', 'utf8');

const regex = /if \(key === 'users'\) \{[\s\S]*?\} else \{[\s\S]*?io\.emit\('data-updated', getSanitizedDbData\(\)\);\s*\}/;

const replacement = `// 2. ?>?? ??> ??????? ??:???? ?'??>?? WebSockets
        io.sockets.sockets.forEach(socket => {
          if (socket.userId) {
            const u = dbData.users.find(usr => usr.id === socket.userId);
            if (u) {
              socket.emit('data-updated', getSanitizedDbDataForUser(u));
            } else {
              socket.emit('data-updated', getSanitizedDbData());
            }
          } else {
            socket.emit('data-updated', getSanitizedDbData());
          }
        });`;

code = code.replace(regex, replacement);

fs.writeFileSync('server/index.js', code);
