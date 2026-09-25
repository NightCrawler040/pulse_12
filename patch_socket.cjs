const fs = require('fs');

let code = fs.readFileSync('server/index.js', 'utf8');

const regexOnline = /socket\.on\('user-online', async \(userId\) => \{([\s\S]*?)\}\);/;
const replacementOnline = `socket.on('user-online', async (userId) => {
    if (userId) {
      socket.userId = userId; // Store on socket for broadcastUpdate
      onlineSockets.set(socket.id, userId);
      console.log(\`[Socket] User \${userId} is online on socket \${socket.id}\`);
      broadcastOnlineUsers();
      
      // Send personalized data now that we know who they are
      const u = dbData.users.find(usr => usr.id === userId);
      socket.emit('data-updated', u ? getSanitizedDbDataForUser(u) : getSanitizedDbData());
    }
  });`;
code = code.replace(regexOnline, replacementOnline);

const regexSync = /socket\.on\('request-sync', async \(\) => \{[\s\S]*?\}\);/;
const replacementSync = `socket.on('request-sync', async () => {
    if (socket.userId) {
      const u = dbData.users.find(usr => usr.id === socket.userId);
      socket.emit('data-updated', u ? getSanitizedDbDataForUser(u) : getSanitizedDbData());
    } else {
      socket.emit('data-updated', getSanitizedDbData());
    }
    broadcastOnlineUsers();
  });`;
code = code.replace(regexSync, replacementSync);

fs.writeFileSync('server/index.js', code);
