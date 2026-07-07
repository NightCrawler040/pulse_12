import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initialUsers, initialSprints, initialTasks, initialGroups } from './initialData.js';
import { initDb, getAllData, saveCollection, saveAllData, isPostgresMode } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Allow CORS from any corporate network PC
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }));
app.use(express.json({ limit: '20mb' }));

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve uploaded avatars and documents statically
app.use('/uploads', express.static(UPLOADS_DIR));

// Load database from PostgreSQL (or fallback file)
let dbData = {
  tasks: [],
  sprints: [],
  users: [],
  groups: [],
  notifications: []
};

// Persist updates to PostgreSQL / local storage and broadcast to all connected corporate PC laptops
const broadcastUpdate = async (key) => {
  try {
    if (key && dbData[key]) {
      await saveCollection(key, dbData[key]);
    } else {
      await saveAllData(dbData);
    }
  } catch (err) {
    console.error('❌ Error persisting data to database:', err);
  }
  io.emit('data-updated', dbData);
};

// --- REST API ENDPOINTS ---

// Get all data
app.get('/api/data', async (req, res) => {
  try {
    dbData = await getAllData();
    res.json(dbData);
  } catch (err) {
    console.error('❌ Error fetching data:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Login check
app.post('/api/login', (req, res) => {
  const { login, password, pin } = req.body;
  
  if (!login && !pin) {
    return res.status(400).json({ success: false, error: 'Введите Логин и Пароль' });
  }

  // Find user by login & password OR pin
  const user = dbData.users.find(u => {
    if (u.isActive === false) return false;
    if (login && password) {
      // Check login (case insensitive) and password
      const matchLogin = (u.login && u.login.toLowerCase() === login.toLowerCase()) || 
                         (u.email && u.email.toLowerCase() === login.toLowerCase()) ||
                         (u.name && u.name.toLowerCase() === login.toLowerCase());
      const matchPassword = (u.password === password) || (u.pin === password);
      return matchLogin && matchPassword;
    } else if (pin) {
      // Legacy or quick pin check
      return u.id === req.body.userId && (u.pin === pin || u.password === pin);
    }
    return false;
  });

  if (user) {
    res.json({ success: true, user });
  } else {
    res.status(401).json({ success: false, error: 'Неверный логин или пароль' });
  }
});

// Create task
app.post('/api/tasks', (req, res) => {
  const newTaskData = req.body;
  const newId = newTaskData.id || `NEX-${Math.floor(100 + Math.random() * 900)}`;
  const now = new Date().toISOString();
  const newTask = {
    ...newTaskData,
    id: newId,
    createdAt: now,
    updatedAt: now,
    comments: newTaskData.comments || []
  };
  dbData.tasks.unshift(newTask);
  broadcastUpdate('tasks');
  res.status(201).json(newTask);
});

// Update task
app.put('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  let found = false;
  dbData.tasks = dbData.tasks.map(t => {
    if (t.id === id) {
      found = true;
      return { ...t, ...updates, updatedAt: new Date().toISOString() };
    }
    return t;
  });
  if (found) {
    broadcastUpdate('tasks');
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Task not found' });
  }
});

// Delete task
app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  dbData.tasks = dbData.tasks.filter(t => t.id !== id);
  broadcastUpdate('tasks');
  res.json({ success: true });
});

// Create user
app.post('/api/users', (req, res) => {
  const userData = req.body;
  const trimmedEmail = (userData.email || '').trim().toLowerCase();
  const trimmedLogin = (userData.login || trimmedEmail.split('@')[0] || '').trim().toLowerCase();

  // Check for duplicate email or login
  const duplicate = dbData.users.find(u => {
    const uEmail = (u.email || '').trim().toLowerCase();
    const uLogin = (u.login || uEmail.split('@')[0] || '').trim().toLowerCase();
    return (trimmedEmail && uEmail === trimmedEmail) || (trimmedLogin && uLogin === trimmedLogin);
  });

  if (duplicate) {
    return res.status(400).json({ error: `Сотрудник с такой почтой или логином уже зарегистрирован (${duplicate.name})!` });
  }

  const newId = `usr-${Date.now()}`;
  const newUser = {
    ...userData,
    id: newId,
    login: userData.login || userData.email?.split('@')[0] || `user_${Date.now()}`,
    password: userData.password || '1234',
    roleType: userData.roleType || 'member',
    pin: userData.pin || userData.password || '1234',
    isActive: true
  };
  dbData.users.push(newUser);
  broadcastUpdate('users');
  res.status(201).json(newUser);
});

// Update user
app.put('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  if (updates.email || updates.login) {
    const trimmedEmail = (updates.email || '').trim().toLowerCase();
    const trimmedLogin = (updates.login || trimmedEmail.split('@')[0] || '').trim().toLowerCase();
    const duplicate = dbData.users.find(u => {
      if (u.id === id) return false;
      const uEmail = (u.email || '').trim().toLowerCase();
      const uLogin = (u.login || uEmail.split('@')[0] || '').trim().toLowerCase();
      return (trimmedEmail && uEmail === trimmedEmail) || (trimmedLogin && uLogin === trimmedLogin);
    });
    if (duplicate) {
      return res.status(400).json({ error: `Сотрудник с такой почтой или логином уже существует (${duplicate.name})!` });
    }
  }

  dbData.users = dbData.users.map(u => {
    if (u.id === id) {
      return { ...u, ...updates };
    }
    return u;
  });
  broadcastUpdate('users');
  res.json({ success: true });
});

// Delete (deactivate or permanent remove) user
app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const { permanent } = req.query;

  if (permanent === 'true') {
    // Hard delete user from database
    dbData.users = dbData.users.filter(u => u.id !== id);
    // Remove from groups
    if (dbData.groups) {
      dbData.groups = dbData.groups.map(g => ({
        ...g,
        memberIds: (g.memberIds || []).filter(mid => mid !== id)
      }));
    }
    // Unassign tasks assigned to this user
    if (dbData.tasks) {
      dbData.tasks = dbData.tasks.map(t => {
        if (t.assigneeId === id) return { ...t, assigneeId: 'unassigned' };
        return t;
      });
    }
    console.log(`🗑️ Permanently deleted user ${id} and cleaned up group/task references.`);
  } else {
    // Soft delete (deactivate / block access)
    dbData.users = dbData.users.map(u => {
      if (u.id === id) {
        return { ...u, isActive: false };
      }
      return u;
    });
    console.log(`🔒 Deactivated user ${id}.`);
  }
  broadcastUpdate();
  res.json({ success: true });
});

// --- GROUPS CRUD ENDPOINTS ---
app.get('/api/groups', (req, res) => {
  res.json(dbData.groups || []);
});

app.post('/api/groups', (req, res) => {
  const groupData = req.body;
  const newId = `grp-${Date.now()}`;
  const newGroup = {
    ...groupData,
    id: newId,
    memberIds: groupData.memberIds || []
  };
  if (!dbData.groups) dbData.groups = [];
  dbData.groups.push(newGroup);
  broadcastUpdate('groups');
  res.status(201).json(newGroup);
});

app.put('/api/groups/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  if (!dbData.groups) dbData.groups = [];
  dbData.groups = dbData.groups.map(g => {
    if (g.id === id) {
      return { ...g, ...updates };
    }
    return g;
  });
  broadcastUpdate('groups');
  res.json({ success: true });
});

app.delete('/api/groups/:id', (req, res) => {
  const { id } = req.params;
  if (!dbData.groups) dbData.groups = [];
  dbData.groups = dbData.groups.filter(g => g.id !== id);
  broadcastUpdate('groups');
  res.json({ success: true });
});

// Sprints CRUD
app.post('/api/sprints', (req, res) => {
  const sprintData = req.body;
  const newId = sprintData.id || `sprint-${Date.now()}`;
  const newSprint = {
    ...sprintData,
    id: newId,
    isActive: sprintData.isActive || false
  };
  if (!dbData.sprints) dbData.sprints = [];
  dbData.sprints.push(newSprint);
  broadcastUpdate('sprints');
  res.status(201).json(newSprint);
});

app.put('/api/sprints/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  if (!dbData.sprints) dbData.sprints = [];
  dbData.sprints = dbData.sprints.map(s => {
    if (s.id === id) {
      return { ...s, ...updates };
    }
    return s;
  });
  broadcastUpdate('sprints');
  res.json({ success: true });
});

app.delete('/api/sprints/:id', (req, res) => {
  const { id } = req.params;
  if (!dbData.sprints) dbData.sprints = [];
  dbData.sprints = dbData.sprints.filter(s => s.id !== id);
  if (!dbData.tasks) dbData.tasks = [];
  dbData.tasks = dbData.tasks.map(t => {
    if (t.sprintId === id) {
      return { ...t, sprintId: 'unassigned' };
    }
    return t;
  });
  broadcastUpdate('sprints');
  broadcastUpdate('tasks');
  res.json({ success: true });
});

// --- FILE UPLOAD ENDPOINT (LOCAL AVATARS) ---
app.post('/api/upload', (req, res) => {
  const { base64 } = req.body;
  if (!base64) {
    return res.status(400).json({ error: 'No base64 image data provided' });
  }
  try {
    // Remove header e.g., "data:image/png;base64,"
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
    const extMatch = base64.match(/^data:image\/(\w+);base64,/);
    const ext = extMatch ? extMatch[1] : 'png';
    const safeName = `avatar_${Date.now()}_${Math.floor(Math.random()*1000)}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, safeName);
    
    fs.writeFileSync(filePath, base64Data, 'base64');
    const fileUrl = `/uploads/${safeName}`;
    console.log(`📁 Saved uploaded photo locally to: ${filePath}`);
    res.json({ success: true, url: fileUrl });
  } catch (err) {
    console.error('❌ Error saving uploaded file:', err);
    res.status(500).json({ error: 'Failed to save file on server' });
  }
});

// --- GENERAL FILE UPLOAD ENDPOINT (TASK ATTACHMENTS up to 50MB) ---
app.post('/api/upload-file', (req, res) => {
  const { filename, base64 } = req.body;
  if (!base64 || !filename) {
    return res.status(400).json({ error: 'No base64 file data or filename provided' });
  }
  try {
    const base64Data = base64.replace(/^data:[^;]+;base64,/, '');
    const ext = path.extname(filename) || '';
    const safeName = `doc_${Date.now()}_${Math.floor(Math.random() * 100000)}${ext}`;
    const filePath = path.join(UPLOADS_DIR, safeName);
    
    fs.writeFileSync(filePath, base64Data, 'base64');
    const fileUrl = `/uploads/${safeName}`;
    const stats = fs.statSync(filePath);
    console.log(`📎 Saved uploaded task document locally to: ${filePath} (${stats.size} bytes)`);
    res.json({ success: true, url: fileUrl, size: stats.size, filename });
  } catch (err) {
    console.error('❌ Error saving uploaded document:', err);
    res.status(500).json({ error: 'Failed to save document on server' });
  }
});

// Reset database
app.post('/api/reset', (req, res) => {
  dbData = {
    tasks: initialTasks,
    sprints: initialSprints,
    users: initialUsers,
    groups: initialGroups
  };
  broadcastUpdate();
  res.json({ success: true });
});

// Import database
app.post('/api/import', (req, res) => {
  const imported = req.body;
  if (imported && Array.isArray(imported.tasks)) {
    dbData.tasks = imported.tasks;
    if (Array.isArray(imported.sprints)) dbData.sprints = imported.sprints;
    if (Array.isArray(imported.users)) dbData.users = imported.users;
    if (Array.isArray(imported.groups)) dbData.groups = imported.groups;
    broadcastUpdate();
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Invalid import format' });
  }
});

// --- WEBSOCKET REAL-TIME SYNC & ONLINE PRESENCE ---
const onlineSockets = new Map(); // socket.id -> userId

const broadcastOnlineUsers = () => {
  const activeIds = Array.from(new Set(onlineSockets.values())).filter(Boolean);
  io.emit('online-users-updated', activeIds);
};

io.on('connection', (socket) => {
  console.log(`⚡ New corporate laptop connected via Socket.io: ${socket.id}`);
  
  // Send current state immediately upon connection
  socket.emit('init-data', dbData);
  broadcastOnlineUsers();

  socket.on('user-online', (userId) => {
    if (userId) {
      onlineSockets.set(socket.id, userId);
      console.log(`🟢 User ${userId} is online on socket ${socket.id}`);
      broadcastOnlineUsers();
    }
  });

  socket.on('request-sync', () => {
    socket.emit('data-updated', dbData);
    broadcastOnlineUsers();
  });

  socket.on('send-notification', (notif) => {
    if (notif && notif.id) {
      if (!Array.isArray(dbData.notifications)) dbData.notifications = [];
      dbData.notifications = [notif, ...dbData.notifications.filter(n => n.id !== notif.id)].slice(0, 200);
      broadcastUpdate('notifications');
    }
    io.emit('notification-received', notif);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Corporate laptop disconnected: ${socket.id}`);
    onlineSockets.delete(socket.id);
    broadcastOnlineUsers();
  });
});

// --- STATIC FRONTEND SERVING FOR PRODUCTION (vSphere VM / Docker) ---
const DIST_DIR = path.join(__dirname, '../dist');
if (fs.existsSync(DIST_DIR)) {
  console.log(`📦 Serving production build from: ${DIST_DIR}`);
  app.use(express.static(DIST_DIR));
  
  // SPA Fallback: support URL routing (/admin, /board, /team, /profile, etc.)
  app.use((req, res) => {
    if (!req.path.startsWith('/api/') && !req.path.startsWith('/uploads/') && !req.path.startsWith('/socket.io/')) {
      res.sendFile(path.join(DIST_DIR, 'index.html'));
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  });
}

const startServer = async () => {
  await initDb();
  dbData = await getAllData();
  console.log(`✅ Инициализированы данные системы (${isPostgresMode() ? 'PostgreSQL' : 'Файловый режим'}): ${dbData.tasks.length} задач, ${dbData.users.length} сотрудников.`);

  const PORT = process.env.PORT || 3001;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Корпоративный сервер Pulse 12 запущен на порту ${PORT}!`);
    console.log(`💻 Локальный адрес: http://localhost:${PORT}`);
    console.log(`🌐 Для подключения с других ПК укажите IP вашей vSphere машины (например, http://192.168.x.x:${PORT})`);
    console.log(`======================================================\n`);
  });
};

startServer();
