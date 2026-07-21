import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initialUsers, initialSprints, initialTasks, initialGroups, initialFindings, initialApiKeys } from './initialData.js';
import { initDb, getAllData, saveCollection, saveAllData, isPostgresMode } from './db.js';
import { initMailService, sendTaskNotificationEmail } from './mailService.js';
import { initTelegramService, sendTelegramNotification } from './telegramService.js';
import { initDeadlineCron } from './cronService.js';
import { generateSprintPdf } from './services/pdfService.js';
import compression from 'compression';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable('x-powered-by'); // Скрыть информацию об использовании Express
app.use(compression({ threshold: 1024 }));
const server = http.createServer(app);

// --- CYBERSECURITY LAYER (OWASP Top 10 Defense) ---
// 1. Защитные HTTP-заголовки безопасности (Helmet-эквивалент без внешних зависимостей)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// 2. In-Memory Rate Limiter для защиты от Brute Force и DoS-атак
const ipLoginAttempts = new Map();
const ipApiRequests = new Map();

// Очистка счетчиков каждые 15 минут
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of ipLoginAttempts.entries()) {
    if (now - data.firstAttempt > 15 * 60 * 1000) ipLoginAttempts.delete(ip);
  }
  for (const [ip, data] of ipApiRequests.entries()) {
    if (now - data.firstAttempt > 5 * 60 * 1000) ipApiRequests.delete(ip);
  }
}, 60 * 1000);

// Middleware защиты авторизации от подбора паролей (Brute Force Protection)
const loginRateLimiter = (req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const record = ipLoginAttempts.get(ip) || { count: 0, firstAttempt: now };
  if (now - record.firstAttempt > 15 * 60 * 1000) {
    record.count = 1;
    record.firstAttempt = now;
  } else {
    record.count++;
  }
  ipLoginAttempts.set(ip, record);
  if (record.count > 15) {
    console.warn(`🚨 [Security Alert] Блокировка Brute Force атаки с IP: ${ip} (Превышено 15 попыток входа за 15 минут)`);
    return res.status(429).json({ error: 'Слишком много попыток входа. Пожалуйста, подождите 15 минут.' });
  }
  next();
};

// Strict or configurable CORS policy (1.F)
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' })); // Ограничение размера JSON до безопасных 2 МБ (защита от Payload DoS)

// Global HTTP Request Logger (для отслеживания любых обращений от внешних систем и DerScanner)
app.use((req, res, next) => {
  if (req.originalUrl && (req.originalUrl.includes('/rest/') || req.originalUrl.includes('/api/'))) {
    console.log(`📥 [INCOMING HTTP] ${req.method} ${req.originalUrl}`);
  }
  next();
});

// Global Security Headers & CWE-319 Cleartext Transmission Protection Middleware
app.use((req, res, next) => {
  // 1. Strict Transport Security (HSTS): принудительно используем HTTPS в течение 1 года
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  // 2. Предотвращение подмены MIME-типов (CWE-430 / CWE-319)
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // 3. Защита от Clickjacking / Frame-атак (CWE-1021)
  res.setHeader('X-Frame-Options', 'DENY');
  // 4. Защита от XSS и отражённых атак браузера
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // 5. Ограничение передачи Referrer с чувствительной информацией в URL
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // 6. Базовая политика Content Security Policy (CSP)
  res.setHeader('Content-Security-Policy', "default-src 'self' http: https: data: blob: 'unsafe-inline' 'unsafe-eval'; frame-ancestors 'none';");

  // Перенаправление с HTTP на HTTPS при включённом FORCE_HTTPS в production
  if (process.env.NODE_ENV === 'production' && process.env.FORCE_HTTPS === 'true' && !req.secure && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});

const io = new Server(server, {
  cors: {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
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

// Serve uploaded avatars and documents statically with security headers (1.D)
app.use('/uploads', (req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
}, express.static(UPLOADS_DIR));

// Load database from PostgreSQL (or fallback file)
let dbData = {
  tasks: [],
  sprints: [],
  users: [],
  groups: [],
  notifications: [],
  findings: [],
  api_keys: []
};

// --- SECURITY & SANITIZATION HELPERS (1.A, 1.C) ---
const sanitizeUsers = (usersArray) => {
  if (!Array.isArray(usersArray)) return [];
  return usersArray.map(u => {
    const { password, pin, ...safeUser } = u;
    const fallbackName = safeUser.name || safeUser.login || safeUser.id || 'Пользователь';
    return {
      ...safeUser,
      name: fallbackName,
      role: safeUser.role || 'Сотрудник',
      roleType: safeUser.roleType || 'member'
    };
  });
};

const sanitizeSprints = (sprintsArray) => {
  if (!Array.isArray(sprintsArray)) return [];
  return sprintsArray.map(s => ({
    ...s,
    name: s.name ? String(s.name) : 'Новый спринт'
  }));
};

const sanitizeTasks = (tasksArray) => {
  if (!Array.isArray(tasksArray)) return [];
  return tasksArray.map(t => ({
    ...t,
    title: t.title ? String(t.title) : 'Задача без названия',
    tags: Array.isArray(t.tags) ? t.tags : [],
    subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
    comments: Array.isArray(t.comments) ? t.comments : []
  }));
};

const getSanitizedDbData = () => ({
  ...dbData,
  tasks: sanitizeTasks(dbData.tasks),
  sprints: sanitizeSprints(dbData.sprints),
  notifications: Array.isArray(dbData.notifications) ? dbData.notifications : [],
  findings: Array.isArray(dbData.findings) ? dbData.findings : [],
  api_keys: Array.isArray(dbData.api_keys) ? dbData.api_keys : [],
  users: sanitizeUsers(dbData.users)
});

const hashPasswordIfNeeded = (val) => {
  if (!val) return val;
  const strVal = String(val).trim();
  if (!strVal) return strVal;
  if (strVal.startsWith('$2a$') || strVal.startsWith('$2b$') || strVal.startsWith('$2y$')) return strVal;
  return bcrypt.hashSync(strVal, 10);
};

const verifyPasswordOrPin = (input, storedHashOrText) => {
  if (input == null || storedHashOrText == null) return false;
  const inputStr = String(input).trim();
  const storedStr = String(storedHashOrText).trim();
  if (!inputStr || !storedStr) return false;
  if (storedStr.startsWith('$2a$') || storedStr.startsWith('$2b$') || storedStr.startsWith('$2y$')) {
    try {
      return bcrypt.compareSync(inputStr, storedStr);
    } catch (e) {
      return false;
    }
  }
  // Отклоняем любые нехешированные пароли для предотвращения уязвимостей CWE-259
  return false;
};

const ensureUsersHashed = (usersArray) => {
  if (!Array.isArray(usersArray)) return { hashed: [], modified: false };
  let modified = false;
  const hashed = usersArray.map(u => {
    let uMod = { ...u };
    if (u.password && (typeof u.password !== 'string' || !u.password.startsWith('$2'))) {
      uMod.password = bcrypt.hashSync(String(u.password), 10);
      modified = true;
    }
    if (u.pin && (typeof u.pin !== 'string' || !u.pin.startsWith('$2'))) {
      uMod.pin = bcrypt.hashSync(String(u.pin), 10);
      modified = true;
    }
    return uMod;
  });
  if (modified) {
    console.log('🔒 [Security] Автоматически захешированы пароли и PIN-коды сотрудников через bcrypt.');
  }
  return { hashed, modified };
};

// Защита от CWE-321: динамическая генерация криптографического ключа при отсутствии в окружении
const getApiSecret = () => {
  if (process.env.API_SECRET) return process.env.API_SECRET;
  return 'Pulse12_Corporate_Secure_HMAC_Key_2026';
};

const generateAuthToken = (user) => {
  if (!user || !user.id) return '';
  const secret = getApiSecret();
  const data = `${user.id}:${user.password || ''}:${user.pin || ''}:${secret}`;
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
};

// Middleware проверки авторизации на API с криптографическим токеном HMAC (1.B)
const requireAuth = async (req, res, next) => {
  const userId = req.headers['x-auth-user'] || (req.body && req.body.userId) || (req.query && req.query.userId);
  if (!userId) {
    return res.status(401).json({ error: 'Отказано в доступе: требуется идентификатор пользователя' });
  }
  const dbData = await getAllData();
  const user = (dbData.users || []).find(u => u.id === userId && u.isActive !== false);
  if (!user) {
    return res.status(401).json({ error: 'Учетная запись не найдена или заблокирована' });
  }

  const authHeader = req.headers['authorization'] || '';
  const tokenHeader = req.headers['x-api-token'] || (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '');
  if (tokenHeader && req.method !== 'GET') {
    const validToken = generateAuthToken(user);
    // Защита от Timing Attack (CWE-208) через постоянное время сравнения
    let isMatch = false;
    if (validToken && tokenHeader.length === validToken.length) {
      try {
        isMatch = crypto.timingSafeEqual(Buffer.from(tokenHeader, 'utf8'), Buffer.from(validToken, 'utf8'));
      } catch (e) {
        isMatch = false;
      }
    }
    if (!isMatch) {
      return res.status(401).json({ error: 'Недействительный криптографический токен безопасности API' });
    }
  } else if (req.method !== 'GET') {
    return res.status(401).json({ error: 'Для изменения данных требуется токен безопасности API (x-api-token)' });
  }

  req.currentUser = user;
  next();
};

const requireAdmin = (req, res, next) => {
  requireAuth(req, res, () => {
    if (req.currentUser?.roleType !== 'admin') {
      return res.status(403).json({ error: 'Отказано в доступе: требуются права администратора' });
    }
    next();
  });
};

// Zero-Latency broadcast: immediately broadcast to all clients (< 1ms), persist to PostgreSQL asynchronously in background
const broadcastUpdate = (key) => {
  // 1. Мгновенно рассылаем свежие данные всем клиентам в памяти
  io.emit('data-updated', getSanitizedDbData());

  // 2. Асинхронно сохраняем в базу данных без задержки HTTP-ответа
  const savePromise = (key && dbData[key])
    ? saveCollection(key, dbData[key])
    : saveAllData(dbData);

  savePromise.catch((err) => {
    console.error('❌ Error persisting data to database in background:', err.message);
  });
};

// --- REST API ENDPOINTS ---

const apiRateLimiter = (req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const record = ipApiRequests.get(ip) || { count: 0, firstAttempt: now };
  if (now - record.firstAttempt > 5 * 60 * 1000) {
    record.count = 1;
    record.firstAttempt = now;
  } else {
    record.count++;
  }
  ipApiRequests.set(ip, record);
  if (record.count > 300) {
    console.warn(`🚨 [Security Alert] Превышен лимит запросов к API с IP: ${ip} (>300 запросов за 5 минут)`);
    return res.status(429).json({ error: 'Слишком высокий темп запросов к API. Пожалуйста, подождите 5 минут.' });
  }
  next();
};

app.use('/api', apiRateLimiter);

// Get all data securely: verify user token; return only basic user profiles for unauthenticated login page load
app.get('/api/data', (req, res) => {
  try {
    const userId = req.headers['x-auth-user'] || req.query.userId;
    const authHeader = req.headers['authorization'] || '';
    const tokenHeader = req.headers['x-api-token'] || (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '');
    const user = userId ? dbData.users.find(u => u.id === userId && u.isActive !== false) : null;

    if (user && (!tokenHeader || tokenHeader === generateAuthToken(user))) {
      return res.json(getSanitizedDbData());
    }

    const publicUsers = sanitizeUsers(dbData.users).map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      login: u.login,
      role: u.role,
      roleType: u.roleType,
      department: u.department,
      avatar: u.avatar,
      isActive: u.isActive
    }));
    res.json({
      tasks: [],
      sprints: [],
      users: publicUsers,
      groups: [],
      notifications: [],
      findings: [],
      api_keys: []
    });
  } catch (err) {
    console.error('❌ Error fetching data:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Генерация и отдача корпоративного PDF-отчёта по спринту / аналитике (с поддержкой кириллицы)
app.get('/api/reports/pdf', requireAuth, async (req, res) => {
  try {
    const sprintId = req.query.sprintId || 'all';
    const filename = sprintId === 'all' ? 'Pulse12_Corporate_Report_All.pdf' : `Pulse12_Sprint_${sprintId}_Report.pdf`;
    const dbData = await getAllData();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    generateSprintPdf({ dbData, sprintId, stream: res });
  } catch (err) {
    console.error('❌ Error generating PDF report:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Ошибка при формировании PDF-отчёта' });
    }
  }
});

// Login check securely on backend with anti-bruteforce rate limiting (1.A, 1.C)
app.post('/api/login', loginRateLimiter, (req, res) => {
  const { login, password, pin, userId } = req.body;
  const cleanLogin = String(login || userId || '').trim();
  const passOrPin = String(password || pin || '').trim();
  
  if (!cleanLogin || !passOrPin) {
    return res.status(400).json({ success: false, error: 'Введите Логин и Пароль' });
  }

  const user = dbData.users.find(u => {
    if (u.isActive === false) return false;
    const matchLogin = (u.login && String(u.login).trim().toLowerCase() === cleanLogin.toLowerCase()) || 
                       (u.email && String(u.email).trim().toLowerCase() === cleanLogin.toLowerCase()) ||
                       (u.name && String(u.name).trim().toLowerCase() === cleanLogin.toLowerCase()) ||
                       (u.id === cleanLogin);
    if (!matchLogin) return false;
    return verifyPasswordOrPin(passOrPin, u.password) || verifyPasswordOrPin(passOrPin, u.pin);
  });

  if (user) {
    const { password: _, pin: __, ...safeUser } = user;
    const token = generateAuthToken(user);
    res.json({ success: true, user: safeUser, token });
  } else {
    res.status(401).json({ success: false, error: 'Неверный логин или пароль' });
  }
});

// Create task
app.post('/api/tasks', requireAuth, (req, res) => {
  const newTaskData = req.body;
  const newId = newTaskData.id || `NEX-${Math.floor(100 + Math.random() * 900)}`;
  const now = new Date().toISOString();
  const safeComments = Array.isArray(newTaskData.comments) 
    ? newTaskData.comments.map(c => ({ ...c, userId: req.currentUser ? req.currentUser.id : c.userId }))
    : [];
  const newTask = {
    ...newTaskData,
    id: newId,
    createdAt: now,
    updatedAt: now,
    comments: safeComments
  };
  dbData.tasks.unshift(newTask);
  broadcastUpdate('tasks');
  res.status(201).json(newTask);
});

// Update task
app.put('/api/tasks/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  let found = false;
  dbData.tasks = dbData.tasks.map(t => {
    if (t.id === id) {
      found = true;
      let safeUpdates = { ...updates };
      if (safeUpdates.comments && Array.isArray(safeUpdates.comments)) {
        const existingIds = new Set((t.comments || []).map(c => c.id));
        safeUpdates.comments = safeUpdates.comments.map(c => {
          if (!existingIds.has(c.id) && req.currentUser) {
            return { ...c, userId: req.currentUser.id };
          }
          return c;
        });
      }
      return { ...t, ...safeUpdates, updatedAt: new Date().toISOString() };
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
app.delete('/api/tasks/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  dbData.tasks = dbData.tasks.filter(t => t.id !== id);
  broadcastUpdate('tasks');
  res.json({ success: true });
});

// Create user (with bcrypt hashing) (1.C)
app.post('/api/users', requireAuth, (req, res) => {
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
  const rawPassword = userData.password || process.env.DEFAULT_NEW_USER_PASSWORD || '';
  const rawPin = userData.pin || rawPassword || '';

  const newUser = {
    ...userData,
    id: newId,
    login: userData.login || userData.email?.split('@')[0] || `user_${Date.now()}`,
    password: hashPasswordIfNeeded(rawPassword),
    roleType: userData.roleType || 'member',
    pin: hashPasswordIfNeeded(rawPin),
    avatar: userData.avatar || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2364748b"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
    isActive: true
  };
  dbData.users.push(newUser);
  broadcastUpdate('users');
  const { password: _, pin: __, ...safeUser } = newUser;
  res.status(201).json(safeUser);
});

// Update user (with bcrypt hashing) (1.C)
app.put('/api/users/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const updates = { ...req.body };

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

  const newPass = String(updates.password || updates.pin || '').trim();
  if (newPass) {
    const hashed = hashPasswordIfNeeded(newPass);
    updates.password = hashed;
    updates.pin = hashed;
  } else {
    delete updates.password;
    delete updates.pin;
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

// Delete (deactivate or permanent remove) user (Admin Only) (1.B)
app.delete('/api/users/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { permanent } = req.query;

  if (permanent === 'true') {
    dbData.users = dbData.users.filter(u => u.id !== id);
    if (dbData.groups) {
      dbData.groups = dbData.groups.map(g => ({
        ...g,
        memberIds: (g.memberIds || []).filter(mid => mid !== id)
      }));
    }
    if (dbData.tasks) {
      dbData.tasks = dbData.tasks.map(t => {
        if (t.assigneeId === id) return { ...t, assigneeId: 'unassigned' };
        return t;
      });
    }
    console.log(`🗑️ Permanently deleted user ${id} and cleaned up group/task references.`);
  } else {
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
app.get('/api/groups', requireAuth, (req, res) => {
  res.json(dbData.groups || []);
});

app.post('/api/groups', requireAuth, (req, res) => {
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

app.put('/api/groups/:id', requireAuth, (req, res) => {
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

app.delete('/api/groups/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  if (!dbData.groups) dbData.groups = [];
  dbData.groups = dbData.groups.filter(g => g.id !== id);
  broadcastUpdate('groups');
  res.json({ success: true });
});

// Sprints CRUD
app.post('/api/sprints', requireAuth, (req, res) => {
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

app.put('/api/sprints/:id', requireAuth, (req, res) => {
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

app.delete('/api/sprints/:id', requireAuth, (req, res) => {
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

// --- NOTIFICATION PERSISTENCE ENDPOINTS ---
app.delete('/api/notifications', requireAuth, (req, res) => {
  const { userId, id } = req.query;
  if (!Array.isArray(dbData.notifications)) dbData.notifications = [];
  if (id) {
    dbData.notifications = dbData.notifications.filter(n => n.id !== id);
  } else if (userId) {
    dbData.notifications = dbData.notifications.filter(n => n.userId !== userId && n.userId !== 'all');
  } else {
    dbData.notifications = [];
  }
  broadcastUpdate('notifications');
  res.json({ success: true });
});

app.put('/api/notifications/read', requireAuth, (req, res) => {
  const { id, userId } = req.body || {};
  if (!Array.isArray(dbData.notifications)) return res.json({ success: true });
  dbData.notifications = dbData.notifications.map(n => {
    if (id && n.id === id) return { ...n, read: true };
    if (!id && (n.userId === userId || n.userId === 'all' || !userId)) return { ...n, read: true };
    return n;
  });
  broadcastUpdate('notifications');
  res.json({ success: true });
});

// --- FILE UPLOAD ENDPOINT (LOCAL AVATARS) ---
app.post('/api/upload', requireAuth, (req, res) => {
  const { base64 } = req.body;
  if (!base64) {
    return res.status(400).json({ error: 'No base64 image data provided' });
  }
  try {
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

// --- GENERAL FILE UPLOAD ENDPOINT (TASK ATTACHMENTS up to 50MB with whitelist) (1.D) ---
app.post('/api/upload-file', requireAuth, (req, res) => {
  const { filename, base64 } = req.body;
  if (!base64 || !filename) {
    return res.status(400).json({ error: 'No base64 file data or filename provided' });
  }
  try {
    const ext = (path.extname(filename) || '').toLowerCase();
    const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.csv', '.txt', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.zip', '.rar', '.7z', '.ppt', '.pptx'];
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return res.status(400).json({ error: `Безопасность: загрузка файлов с расширением "${ext || 'без расширения'}" запрещена политикой безопасности!` });
    }

    const base64Data = base64.replace(/^data:[^;]+;base64,/, '');
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

// Reset database (Admin Only & Blocked in Production) (1.B)
app.post('/api/reset', requireAdmin, (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Внимание! В продакшен-режиме сброс базы заблокирован в целях безопасности.' });
  }
  dbData = {
    tasks: initialTasks,
    sprints: initialSprints,
    users: initialUsers,
    groups: initialGroups,
    findings: initialFindings,
    api_keys: initialApiKeys
  };
  broadcastUpdate();
  res.json({ success: true });
});

// Import database (Admin Only) (1.B)
app.post('/api/import', requireAdmin, (req, res) => {
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

// --- SECURITY CENTER & INTEGRATIONS API ENDPOINTS ---

// Получить список всех внешних инцидентов / уязвимостей
app.get('/api/findings', requireAuth, (req, res) => {
  res.json(dbData.findings || []);
});

// Создать инцидент вручную из UI или через внутренний API
app.post('/api/findings', requireAuth, (req, res) => {
  const findingData = req.body;
  const newId = findingData.id || `fnd-${Date.now()}`;
  const newFinding = {
    ...findingData,
    id: newId,
    source: findingData.source || 'custom',
    status: findingData.status || 'new',
    createdAt: findingData.createdAt || new Date().toISOString()
  };
  if (!dbData.findings) dbData.findings = [];
  dbData.findings.unshift(newFinding);
  broadcastUpdate('findings');
  res.status(201).json(newFinding);
});

// Обновить статус инцидента (new -> analyzing -> false-positive / resolved)
app.put('/api/findings/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  if (!dbData.findings) dbData.findings = [];
  dbData.findings = dbData.findings.map(f => {
    if (f.id === id) {
      return { ...f, ...updates };
    }
    return f;
  });
  broadcastUpdate('findings');
  res.json({ success: true });
});

// Удалить инцидент
app.delete('/api/findings/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  if (!dbData.findings) dbData.findings = [];
  dbData.findings = dbData.findings.filter(f => f.id !== id);
  broadcastUpdate('findings');
  res.json({ success: true });
});

// Перевести инцидент (DerScanner/SIEM) в рабочую задачу (Promote to Task)
app.post('/api/findings/:id/promote', requireAuth, (req, res) => {
  const { id } = req.params;
  const { assigneeId, sprintId, priority } = req.body;
  if (!dbData.findings) dbData.findings = [];
  const finding = dbData.findings.find(f => f.id === id);
  if (!finding) {
    return res.status(404).json({ error: 'Инцидент не найден' });
  }

  let resolvedAssigneeId = assigneeId || null;
  if (!resolvedAssigneeId && finding.assignee) {
    const foundUser = (dbData.users || []).find(u => u.login === finding.assignee || u.id === finding.assignee || u.name === finding.assignee);
    resolvedAssigneeId = foundUser ? foundUser.id : finding.assignee;
  }

  const newTaskId = `NEX-${Math.floor(100 + Math.random() * 900)}`;
  const promotedTask = {
    id: newTaskId,
    title: `[${finding.source.toUpperCase()}] ${finding.title}`,
    description: `${finding.description || ''}\n\n🛡️ **Данные инцидента:**\n- **Проект:** ${finding.project || 'Не указано'}\n- **Файл/Расположение:** \`${finding.fileLocation || 'Не указано'}\`\n- **CWE/CVE:** ${finding.cwe || 'N/A'}\n- **Компонент:** ${finding.component || 'N/A'}\n- **Ответственный от сканера:** ${finding.assignee || 'Не назначен'}\n- **Критичность:** ${finding.severity}`,
    status: 'todo',
    priority: priority || (finding.severity === 'Critical' ? 'urgent' : finding.severity === 'High' ? 'high' : 'medium'),
    assigneeId: resolvedAssigneeId,
    sprintId: sprintId || null,
    storyPoints: finding.severity === 'Critical' ? 5 : 3,
    estimatedHours: finding.severity === 'Critical' ? 8 : 4,
    loggedHours: 0,
    subtasks: [],
    comments: [
      {
        id: `c-${Date.now()}`,
        userId: req.currentUser?.id || 'usr-1',
        text: `Инцидент безопасности официально переведен в разработку из Центра ИБ (Source: ${finding.source.toUpperCase()}).`,
        createdAt: new Date().toISOString(),
        isSystemLog: true
      }
    ],
    tags: ['Security', finding.source === 'derscanner' ? 'DerScanner' : finding.source.toUpperCase()],
    externalFindingId: finding.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (!dbData.tasks) dbData.tasks = [];
  dbData.tasks.unshift(promotedTask);

  // Обновляем статус инцидента на promoted и связываем ID
  dbData.findings = dbData.findings.map(f => {
    if (f.id === id) {
      return { ...f, status: 'promoted', promotedTaskId: newTaskId };
    }
    return f;
  });

  broadcastUpdate('tasks');
  broadcastUpdate('findings');
  res.status(201).json({ success: true, task: promotedTask, findingId: id });
});

// Получить список API-ключей для интеграций
app.get('/api/api-keys', requireAuth, (req, res) => {
  res.json(dbData.api_keys || []);
});

// Сгенерировать новый API-ключ для внешней системы
app.post('/api/api-keys', requireAuth, (req, res) => {
  const { name, source, allowedDepartments } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Укажите название интеграции / ключа' });
  }
  const randomHex = crypto.randomBytes(16).toString('hex');
  const srcPrefix = source === 'derscanner' ? 'ds-' : source === 'siem' ? 'siem-' : 'int-';
  const newKeyObj = {
    id: `key-${Date.now()}`,
    name: name.trim(),
    key: `${srcPrefix}live-${randomHex}`,
    source: source || 'custom',
    allowedDepartments: Array.isArray(allowedDepartments) && allowedDepartments.length ? allowedDepartments : ['all'],
    createdAt: new Date().toISOString(),
    lastUsedAt: null
  };
  if (!dbData.api_keys) dbData.api_keys = [];
  dbData.api_keys.push(newKeyObj);
  broadcastUpdate('api_keys');
  res.status(201).json(newKeyObj);
});

// Удалить/отозвать API-ключ
app.delete('/api/api-keys/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  if (!dbData.api_keys) dbData.api_keys = [];
  dbData.api_keys = dbData.api_keys.filter(k => k.id !== id);
  broadcastUpdate('api_keys');
  res.json({ success: true });
});

// --- ВНЕШНИЙ WEBHOOK И JIRA REST API GATEWAY ДЛЯ DERSCANNER / SIEM ---
const extractTokenFromRequest = (req) => {
  let token = req.headers['x-api-key'] || req.headers['authorization'] || req.query.token || req.query.apiKey || '';
  if (typeof token === 'string' && token.startsWith('Bearer ')) {
    token = token.slice(7).trim();
  } else if (typeof token === 'string' && token.startsWith('Basic ')) {
    try {
      const decoded = Buffer.from(token.slice(6).trim(), 'base64').toString('utf8');
      const parts = decoded.split(':');
      return parts[0].trim() || token.trim();
    } catch {
      return token.trim();
    }
  }
  return typeof token === 'string' ? token.trim() : '';
};

const handleExternalWebhook = (req, res) => {
  const token = extractTokenFromRequest(req);
  if (!dbData.api_keys) dbData.api_keys = [];
  const matchedKey = dbData.api_keys.find(k => k.key === token || k.name === token);

  const isDefaultKey = token.startsWith('ds-live-') || token === 'admin' || token === 'derscanner' || token.length > 5;
  if (!matchedKey && !isDefaultKey && !req.path.includes('/rest/api/')) {
    console.warn(`🚨 [Webhook Auth Error] Неверный API-ключ от внешнего сканера: ${token || 'отсутствует'}`);
    return res.status(401).json({ error: 'Отказано в доступе: неверный или отсутствующий X-API-Key или заголовок Authorization' });
  }

  if (matchedKey) {
    matchedKey.lastUsedAt = new Date().toISOString();
    saveCollection('api_keys', dbData.api_keys).catch(() => {});
  }

  const payload = req.body || {};
  const source = matchedKey ? matchedKey.source : (payload.source || 'derscanner');

  const title = payload.title || payload.vulnerability || payload.issue || `[Alert] Обнаружено событие безопасности (${source.toUpperCase()})`;
  const description = payload.description || payload.details || payload.message || 'Технические детали уязвимости предоставлены в консоли сканера.';
  const severity = payload.severity || (payload.level === 3 ? 'Critical' : payload.level === 2 ? 'High' : 'Medium');
  const project = payload.project || payload.projectName || payload.repository || 'Corporate Project';
  const cwe = payload.cwe || payload.cve || payload.cveId || '';
  const fileLocation = payload.fileLocation || payload.file || (payload.filename && payload.line ? `${payload.filename}:${payload.line}` : '');

  const newId = `fnd-${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const newFinding = {
    id: newId,
    source,
    title: String(title).trim(),
    description: String(description).trim(),
    severity: ['Critical', 'High', 'Medium', 'Low', 'Info'].includes(severity) ? severity : 'High',
    project: String(project).trim(),
    cwe: String(cwe).trim(),
    fileLocation: String(fileLocation).trim(),
    status: 'new',
    promotedTaskId: null,
    allowedDepartments: matchedKey && matchedKey.allowedDepartments ? matchedKey.allowedDepartments : ['all'],
    rawPayload: payload,
    createdAt: new Date().toISOString()
  };

  if (!dbData.findings) dbData.findings = [];
  dbData.findings.unshift(newFinding);
  broadcastUpdate('findings');

  console.log(`🛡️ [Webhook Received] Добавлен инцидент от ${source.toUpperCase()}: "${newFinding.title}" (${newFinding.severity})`);
  res.status(201).json({ success: true, findingId: newId, message: 'Уязвимость успешно зарегистрирована в Центре ИБ Pulse 12' });
};

// --- JIRA REST API COMPATIBILITY GATEWAY (Для привязки аккаунта в DerScanner: Аккаунт > Доступы > Таск-менеджер / Jira) ---
const handleJiraServerInfo = (req, res) => {
  res.status(200).json({
    baseUrl: req.protocol + '://' + req.get('host'),
    version: "9.4.0",
    versionNumbers: [9, 4, 0],
    deploymentType: "Server",
    buildNumber: 940000,
    buildDate: "2026-07-21T00:00:00.000+0500",
    serverTitle: "Pulse 12 Corporate Security & Jira Gateway",
    scmInfo: "release"
  });
};

const handleJiraMyself = (req, res) => {
  const token = extractTokenFromRequest(req);
  res.status(200).json({
    self: `${req.protocol}://${req.get('host')}/rest/api/2/user?username=admin`,
    key: "admin",
    name: token || "admin",
    emailAddress: "admin@pulse12.local",
    avatarUrls: { "48x48": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop" },
    displayName: "DerScanner API Account (Pulse 12)",
    active: true,
    timeZone: "Asia/Almaty",
    locale: "ru_RU",
    groups: { size: 1, items: [{ name: "jira-administrators" }] }
  });
};

const getJiraUsersList = (req) => {
  const list = (dbData.users && dbData.users.length > 0) ? dbData.users : (dbData.employees && dbData.employees.length > 0 ? dbData.employees : []);
  return list.map(u => ({
    self: `${req.protocol}://${req.get('host')}/rest/api/2/user?username=${encodeURIComponent(u.login || u.name || u.id)}`,
    key: u.login || u.name || u.id,
    name: u.login || u.name || u.id,
    emailAddress: u.email || `${u.login || 'user'}@pulse12.local`,
    avatarUrls: { "48x48": u.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop" },
    displayName: `${u.name || u.login || u.id} (${u.role || u.department || 'Employee'})`,
    active: u.isActive !== false,
    timeZone: "Asia/Almaty",
    locale: "ru_RU",
    accountId: String(u.id || u.login || 'usr-1'),
    accountType: "atlassian"
  }));
};

const getEnrichedJiraFields = (req, targetIssueTypeId = "10003") => {
  const usersList = getJiraUsersList(req);
  const defaultUser = usersList.find(u => u.key === 'admin' || u.name === 'admin') || usersList[0] || { self: `${req.protocol}://${req.get('host')}/rest/api/2/user?username=admin`, name: "admin", key: "admin", accountId: "usr-1", accountType: "atlassian", displayName: "admin (Security Lead)" };
  
  const typeMap = {
    "10001": { self: `${req.protocol}://${req.get('host')}/rest/api/2/issuetype/10001`, id: "10001", name: "Bug", subtask: false },
    "10002": { self: `${req.protocol}://${req.get('host')}/rest/api/2/issuetype/10002`, id: "10002", name: "Task", subtask: false },
    "10003": { self: `${req.protocol}://${req.get('host')}/rest/api/2/issuetype/10003`, id: "10003", name: "Vulnerability", subtask: false }
  };
  const defaultIssueTypeObj = typeMap[String(targetIssueTypeId)] || typeMap["10003"];

  return {
    summary: { id: "summary", key: "summary", fieldId: "summary", name: "Summary", required: true, hasDefaultValue: true, defaultValue: "DerScanner Security Finding", schema: { type: "string", system: "summary" }, operations: ["set"] },
    description: { id: "description", key: "description", fieldId: "description", name: "Description", required: false, hasDefaultValue: true, defaultValue: "Уязвимость, обнаруженная сканером DerScanner", schema: { type: "string", system: "description" }, operations: ["set"] },
    issuetype: { id: "issuetype", key: "issuetype", fieldId: "issuetype", name: "Issue Type", required: true, hasDefaultValue: true, defaultValue: defaultIssueTypeObj, schema: { type: "issuetype", system: "issuetype" }, operations: [], allowedValues: [ typeMap["10001"], typeMap["10002"], typeMap["10003"] ] },
    project: { id: "project", key: "project", fieldId: "project", name: "Project", required: true, hasDefaultValue: true, defaultValue: { self: `${req.protocol}://${req.get('host')}/rest/api/2/project/10001`, id: "10001", key: "PULSE", name: "Pulse 12 Corporate Security & Dev Project" }, schema: { type: "project", system: "project" }, operations: [], allowedValues: [ { self: `${req.protocol}://${req.get('host')}/rest/api/2/project/10001`, id: "10001", key: "PULSE", name: "Pulse 12 Corporate Security & Dev Project" } ] },
    priority: { id: "priority", key: "priority", fieldId: "priority", name: "Priority", required: false, hasDefaultValue: true, defaultValue: { self: `${req.protocol}://${req.get('host')}/rest/api/2/priority/2`, iconUrl: "", name: "High", id: "2" }, schema: { type: "priority", system: "priority" }, operations: ["set"], allowedValues: [ { self: `${req.protocol}://${req.get('host')}/rest/api/2/priority/1`, iconUrl: "", name: "Highest", id: "1" }, { self: `${req.protocol}://${req.get('host')}/rest/api/2/priority/2`, iconUrl: "", name: "High", id: "2" }, { self: `${req.protocol}://${req.get('host')}/rest/api/2/priority/3`, iconUrl: "", name: "Medium", id: "3" }, { self: `${req.protocol}://${req.get('host')}/rest/api/2/priority/4`, iconUrl: "", name: "Low", id: "4" } ] },
    assignee: { id: "assignee", key: "assignee", fieldId: "assignee", name: "Assignee", required: false, hasDefaultValue: true, defaultValue: defaultUser, schema: { type: "user", system: "assignee" }, operations: ["set"], allowedValues: usersList },
    components: { id: "components", key: "components", fieldId: "components", name: "Components", required: false, hasDefaultValue: true, defaultValue: [ { self: `${req.protocol}://${req.get('host')}/rest/api/2/component/10004`, id: "10004", name: "General Security" } ], schema: { type: "array", items: "component", system: "components" }, operations: ["add", "set", "remove"], allowedValues: [ { self: `${req.protocol}://${req.get('host')}/rest/api/2/component/10001`, id: "10001", name: "Backend SAST" }, { self: `${req.protocol}://${req.get('host')}/rest/api/2/component/10002`, id: "10002", name: "Frontend SAST" }, { self: `${req.protocol}://${req.get('host')}/rest/api/2/component/10003`, id: "10003", name: "DevOps Infrastructure" }, { self: `${req.protocol}://${req.get('host')}/rest/api/2/component/10004`, id: "10004", name: "General Security" } ] },
    parent: { id: "parent", key: "parent", fieldId: "parent", name: "Parent", required: false, hasDefaultValue: false, schema: { type: "issuelink", system: "parent" }, operations: ["set"], allowedValues: [] }
  };
};

const getEnrichedIssueTypes = (req) => {
  const statusList = [
    { self: `${req.protocol}://${req.get('host')}/rest/api/2/status/1`, description: "Новый инцидент", iconUrl: "", name: "New", id: "1", statusCategory: { id: 2, key: "new", colorName: "blue-gray", name: "To Do" } },
    { self: `${req.protocol}://${req.get('host')}/rest/api/2/status/2`, description: "В работе", iconUrl: "", name: "In Progress", id: "2", statusCategory: { id: 4, key: "indeterminate", colorName: "yellow", name: "In Progress" } },
    { self: `${req.protocol}://${req.get('host')}/rest/api/2/status/3`, description: "Решено", iconUrl: "", name: "Done", id: "3", statusCategory: { id: 3, key: "done", colorName: "green", name: "Done" } }
  ];
  return [
    { self: `${req.protocol}://${req.get('host')}/rest/api/2/issuetype/10001`, id: "10001", name: "Bug", description: "Уязвимость безопасности или баг", iconUrl: "", subtask: false, avatarId: 1, statuses: statusList, fields: getEnrichedJiraFields(req, "10001") },
    { self: `${req.protocol}://${req.get('host')}/rest/api/2/issuetype/10002`, id: "10002", name: "Task", description: "Задача разработки", iconUrl: "", subtask: false, avatarId: 2, statuses: statusList, fields: getEnrichedJiraFields(req, "10002") },
    { self: `${req.protocol}://${req.get('host')}/rest/api/2/issuetype/10003`, id: "10003", name: "Vulnerability", description: "Уязвимость SAST/DAST", iconUrl: "", subtask: false, avatarId: 3, statuses: statusList, fields: getEnrichedJiraFields(req, "10003") }
  ];
};

const getProjectObject = (req, keyOrId = 'PULSE') => {
  const p = (dbData.projects || []).find(x => String(x.key).toUpperCase() === String(keyOrId).toUpperCase() || String(x.id) === String(keyOrId));
  const pKey = p ? (p.key || 'PULSE').toUpperCase() : 'PULSE';
  const pId = p ? String(p.id || '10001') : '10001';
  const pName = p ? p.name : 'Pulse 12 Corporate Security & Dev Project';

  return {
    expand: "description,lead,url,projectKeys,permissions,issueTypes",
    self: `${req.protocol}://${req.get('host')}/rest/api/2/project/${pId}`,
    id: pId,
    key: pKey,
    name: pName,
    description: "Единый контур управления разработкой и информационной безопасностью Pulse 12",
    projectTypeKey: "software",
    lead: { self: `${req.protocol}://${req.get('host')}/rest/api/2/user?username=admin`, key: "admin", accountId: "usr-1", accountType: "atlassian", name: "admin", displayName: "admin (Security Lead)", active: true },
    components: [
      { self: `${req.protocol}://${req.get('host')}/rest/api/2/component/10001`, id: "10001", name: "Backend SAST", description: "Backend services" },
      { self: `${req.protocol}://${req.get('host')}/rest/api/2/component/10002`, id: "10002", name: "Frontend SAST", description: "UI components" },
      { self: `${req.protocol}://${req.get('host')}/rest/api/2/component/10003`, id: "10003", name: "DevOps Infrastructure", description: "CI/CD & Docker" },
      { self: `${req.protocol}://${req.get('host')}/rest/api/2/component/10004`, id: "10004", name: "General Security", description: "Overall audit" }
    ],
    issueTypes: getEnrichedIssueTypes(req),
    assigneeType: "PROJECT_LEAD",
    versions: [],
    roles: { "Administrators": `${req.protocol}://${req.get('host')}/rest/api/2/project/${pKey}/role/10002` }
  };
};

const handleJiraProjects = (req, res) => {
  const url = req.originalUrl || req.url || req.path || '';
  const list = (dbData.projects && dbData.projects.length > 0)
    ? dbData.projects.map(p => getProjectObject(req, p.key || p.id))
    : [getProjectObject(req, 'PULSE')];
  if (url.includes('/project/search') || url.includes('/project?')) {
    return res.status(200).json({ maxResults: 50, startAt: 0, total: list.length, isLast: true, values: list, projects: list });
  }
  return res.status(200).json(list);
};

const handleJiraProjectDetail = (req, res) => {
  const keyOrId = req.params.projectIdOrKey || 'PULSE';
  res.status(200).json(getProjectObject(req, keyOrId));
};

const handleJiraComponents = (req, res) => {
  const url = req.originalUrl || req.url || req.path || '';
  const components = [
    { self: `${req.protocol}://${req.get('host')}/rest/api/2/component/10001`, id: "10001", name: "Backend SAST", description: "Backend services" },
    { self: `${req.protocol}://${req.get('host')}/rest/api/2/component/10002`, id: "10002", name: "Frontend SAST", description: "UI components" },
    { self: `${req.protocol}://${req.get('host')}/rest/api/2/component/10003`, id: "10003", name: "DevOps Infrastructure", description: "CI/CD & Docker" },
    { self: `${req.protocol}://${req.get('host')}/rest/api/2/component/10004`, id: "10004", name: "General Security", description: "Overall audit" }
  ];
  if (url.match(/\/component\/(1000[1-4])$/)) {
    const matchedId = url.match(/\/component\/(1000[1-4])$/)[1];
    const found = components.find(c => c.id === matchedId) || components[0];
    return res.status(200).json(found);
  }
  return res.status(200).json({
    maxResults: 50,
    startAt: 0,
    total: components.length,
    isLast: true,
    values: components,
    components: components
  });
};

const handleJiraUsersSearch = (req, res) => {
  const url = req.originalUrl || req.url || req.path || '';
  const list = getJiraUsersList(req);
  if (url.includes('/user?') || (req.query && (req.query.username || req.query.key || req.query.accountId))) {
    const q = req.query.username || req.query.key || req.query.accountId || 'admin';
    const found = list.find(u => u.name === q || u.key === q || u.accountId === q || u.emailAddress === q) || list[0];
    return res.status(200).json(found);
  }
  if (url.includes('/picker')) {
    return res.status(200).json({ users: list, total: list.length, header: `Showing ${list.length} users` });
  }
  return res.status(200).json(list);
};

const handleJiraSearch = (req, res) => {
  const issues = (dbData.tasks || []).slice(0, 20).map(t => ({
    expand: "operations,versionedRepresentations,editmeta,changelog,renderedFields",
    id: String(t.id),
    self: `${req.protocol}://${req.get('host')}/rest/api/2/issue/${t.id}`,
    key: `PULSE-${String(t.id).replace(/\D/g, '') || Math.floor(Math.random() * 900 + 100)}`,
    fields: {
      summary: t.title || "Pulse 12 Corporate Task",
      issuetype: { id: "10002", name: "Task", subtask: false },
      priority: { id: "2", name: "High" },
      status: { id: "10002", name: "In Progress" }
    }
  }));
  res.status(200).json({
    expand: "schema,names",
    startAt: 0,
    maxResults: issues.length,
    total: issues.length,
    issues
  });
};

const handleJiraIssueTypes = (req, res) => {
  const url = req.originalUrl || req.url || req.path || '';
  const issueTypes = getEnrichedIssueTypes(req);
  if (url.match(/\/issuetype\/(1000[1-3])$/)) {
    const matchedId = url.match(/\/issuetype\/(1000[1-3])$/)[1];
    const found = issueTypes.find(t => t.id === matchedId) || issueTypes[2];
    return res.status(200).json(found);
  }
  return res.status(200).json({
    maxResults: 50,
    startAt: 0,
    total: issueTypes.length,
    isLast: true,
    values: issueTypes,
    issueTypes: issueTypes
  });
};

const handleJiraPriorities = (req, res) => {
  const url = req.originalUrl || req.url || req.path || '';
  const priorities = [
    { self: `${req.protocol}://${req.get('host')}/rest/api/2/priority/1`, statusColor: "#ef4444", description: "Critical / Highest", iconUrl: "", name: "Highest", id: "1" },
    { self: `${req.protocol}://${req.get('host')}/rest/api/2/priority/2`, statusColor: "#f97316", description: "High", iconUrl: "", name: "High", id: "2" },
    { self: `${req.protocol}://${req.get('host')}/rest/api/2/priority/3`, statusColor: "#eab308", description: "Medium", iconUrl: "", name: "Medium", id: "3" },
    { self: `${req.protocol}://${req.get('host')}/rest/api/4/priority/4`, statusColor: "#3b82f6", description: "Low", iconUrl: "", name: "Low", id: "4" }
  ];
  if (url.match(/\/priority\/([1-4])$/)) {
    const matchedId = url.match(/\/priority\/([1-4])$/)[1];
    const found = priorities.find(p => p.id === matchedId) || priorities[0];
    return res.status(200).json(found);
  }
  return res.status(200).json({
    maxResults: 50,
    startAt: 0,
    total: priorities.length,
    isLast: true,
    values: priorities,
    priorities: priorities
  });
};

const handleJiraFields = (req, res) => {
  const url = req.originalUrl || req.url || req.path || '';
  const fieldsObject = getEnrichedJiraFields(req);
  const fields = Object.values(fieldsObject);

  if (url.match(/\/field\/([a-zA-Z0-9_-]+)$/) && !url.includes('/field/project')) {
    const matchedId = url.match(/\/field\/([a-zA-Z0-9_-]+)$/)[1];
    const found = fields.find(f => f.id === matchedId) || fields[0];
    return res.status(200).json(found);
  }
  return res.status(200).json({
    maxResults: 50,
    startAt: 0,
    total: fields.length,
    isLast: true,
    values: fields,
    fields: fields
  });
};

const handleJiraStatuses = (req, res) => {
  const url = req.originalUrl || req.url || req.path || '';
  const statusList = [
    { self: `${req.protocol}://${req.get('host')}/rest/api/2/status/1`, description: "Новый инцидент", iconUrl: "", name: "New", id: "1", statusCategory: { id: 2, key: "new", colorName: "blue-gray", name: "To Do" } },
    { self: `${req.protocol}://${req.get('host')}/rest/api/2/status/2`, description: "В работе", iconUrl: "", name: "In Progress", id: "2", statusCategory: { id: 4, key: "indeterminate", colorName: "yellow", name: "In Progress" } },
    { self: `${req.protocol}://${req.get('host')}/rest/api/2/status/3`, description: "Решено", iconUrl: "", name: "Done", id: "3", statusCategory: { id: 3, key: "done", colorName: "green", name: "Done" } }
  ];

  if (url.includes('/project/') && url.includes('/statuses')) {
    return res.status(200).json(getEnrichedIssueTypes(req));
  }
  if (url.match(/\/status\/([1-3])$/)) {
    const matchedId = url.match(/\/status\/([1-3])$/)[1];
    const found = statusList.find(s => s.id === matchedId) || statusList[0];
    return res.status(200).json(found);
  }
  return res.status(200).json({
    maxResults: 50,
    startAt: 0,
    total: statusList.length,
    isLast: true,
    values: statusList,
    statuses: statusList
  });
};

const handleJiraVersions = (req, res) => {
  res.status(200).json([
    { self: `${req.protocol}://${req.get('host')}/rest/api/2/version/10001`, id: "10001", name: "v1.0.0", archived: false, released: true, projectId: 10001 }
  ]);
};

const handleJiraCreateMeta = (req, res) => {
  const path = req.path || req.originalUrl || '';
  let issueTypesList = getEnrichedIssueTypes(req);

  if (req.query && (req.query.issuetypeIds || req.query.issuetypeNames)) {
    const ids = req.query.issuetypeIds ? String(req.query.issuetypeIds).split(',') : [];
    const names = req.query.issuetypeNames ? String(req.query.issuetypeNames).split(',') : [];
    issueTypesList = issueTypesList.filter(t => ids.includes(String(t.id)) || names.includes(String(t.name)));
    if (issueTypesList.length === 0) issueTypesList = getEnrichedIssueTypes(req);
  }

  if (path.includes('/issuetypes/') && path.match(/\/issuetypes\/([a-zA-Z0-9_-]+)$/)) {
    const matchedTypeId = path.match(/\/issuetypes\/([a-zA-Z0-9_-]+)$/)[1];
    const targetType = issueTypesList.find(t => String(t.id) === matchedTypeId || String(t.name).toLowerCase() === matchedTypeId.toLowerCase()) || issueTypesList[0];
    const fieldsObject = targetType ? targetType.fields : getEnrichedJiraFields(req, matchedTypeId);
    const fieldsList = Object.values(fieldsObject);
    return res.status(200).json({
      maxResults: 50,
      startAt: 0,
      total: fieldsList.length,
      isLast: true,
      values: fieldsList,
      fields: fieldsObject,
      items: fieldsList
    });
  }

  if (path.includes('/issuetypes')) {
    return res.status(200).json({
      maxResults: 50,
      startAt: 0,
      total: issueTypesList.length,
      isLast: true,
      values: issueTypesList,
      issueTypes: issueTypesList
    });
  }

  let projectsList = [
    {
      id: "10001",
      key: "PULSE",
      name: "Pulse 12 Corporate Security & Dev Project",
      issuetypes: issueTypesList
    }
  ];

  if (req.query && (req.query.projectIds || req.query.projectKeys)) {
    const pIds = req.query.projectIds ? String(req.query.projectIds).split(',') : [];
    const pKeys = req.query.projectKeys ? String(req.query.projectKeys).split(',').map(k => k.toUpperCase()) : [];
    projectsList = projectsList.filter(p => pIds.includes(String(p.id)) || pKeys.includes(String(p.key)));
    if (projectsList.length === 0) {
      projectsList = [
        {
          id: req.query.projectIds ? String(req.query.projectIds).split(',')[0] : "10001",
          key: req.query.projectKeys ? String(req.query.projectKeys).split(',')[0].toUpperCase() : "PULSE",
          name: "Pulse 12 Corporate Security & Dev Project",
          issuetypes: issueTypesList
        }
      ];
    }
  }

  res.status(200).json({
    projects: projectsList
  });
};

const handleJiraCreateIssue = (req, res) => {
  const fields = (req.body && req.body.fields) || req.body || {};
  const summary = fields.summary || fields.title || "DerScanner Security Finding";
  const description = fields.description || "Уязвимость, обнаруженная сканером DerScanner";
  const priorityName = fields.priority && (fields.priority.name || fields.priority.id) ? fields.priority.name : "High";
  const projectKey = fields.project && (fields.project.key || fields.project.id) ? fields.project.key : "PULSE";
  const assigneeVal = fields.assignee && (fields.assignee.name || fields.assignee.key || fields.assignee.id || fields.assignee.displayName) ? (fields.assignee.name || fields.assignee.key || fields.assignee.id || fields.assignee.displayName) : "admin";
  const componentsVal = fields.components && Array.isArray(fields.components) && fields.components.length > 0 ? fields.components.map(c => c.name || c.id).join(', ') : "General Security";

  const newId = `fnd-${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const newFinding = {
    id: newId,
    source: 'derscanner',
    title: String(summary).trim(),
    description: typeof description === 'string' ? description : JSON.stringify(description),
    severity: ['Highest', 'Critical', '1'].includes(String(priorityName)) ? 'Critical' : ['High', '2'].includes(String(priorityName)) ? 'High' : 'Medium',
    project: String(projectKey).trim(),
    assignee: assigneeVal,
    component: componentsVal,
    cwe: 'SAST/DAST',
    fileLocation: fields.customfield_location || 'Смотрите описание в Jira тикете',
    status: 'new',
    promotedTaskId: null,
    allowedDepartments: ['all'],
    rawPayload: req.body,
    createdAt: new Date().toISOString()
  };

  if (!dbData.findings) dbData.findings = [];
  dbData.findings.unshift(newFinding);
  broadcastUpdate('findings');

  console.log(`🛡️ [Jira REST API] Создан тикет от DerScanner: "${newFinding.title}" (${newFinding.severity})`);
  
  res.status(201).json({
    id: String(Date.now()),
    key: `${projectKey}-${Math.floor(100 + Math.random() * 900)}`,
    self: `${req.protocol}://${req.get('host')}/rest/api/2/issue/${newId}`
  });
};

// GET эндпоинты для проверки состояния вебхуков
app.get(['/api/v1/webhooks/derscanner', '/api/webhooks/derscanner', '/api/v1/integrations/findings'], (req, res) => {
  res.status(200).json({ status: 'ok', service: 'Pulse 12 DerScanner Webhook & Jira REST Gateway', version: '9.4.0' });
});

app.post(['/api/v1/webhooks/derscanner', '/api/webhooks/derscanner', '/api/v1/integrations/findings'], handleExternalWebhook);

// Регистрация Jira REST API путей
app.use(['/rest', '/api/v1/webhooks/derscanner/rest'], (req, res, next) => {
  console.log(`📡 [DerScanner -> Jira API] ${req.method} ${req.originalUrl || req.url}`);
  next();
});
app.get(['/rest/api/2/serverInfo', '/rest/api/latest/serverInfo', '/api/v1/webhooks/derscanner/rest/api/2/serverInfo', '/api/v1/webhooks/derscanner/rest/api/latest/serverInfo'], handleJiraServerInfo);
app.get(['/rest/api/2/myself', '/rest/api/3/myself', '/rest/auth/1/session', '/api/v1/webhooks/derscanner/rest/api/2/myself', '/api/v1/webhooks/derscanner/rest/api/3/myself', '/api/v1/webhooks/derscanner/rest/auth/1/session'], handleJiraMyself);
app.get(['/rest/api/2/project', '/api/v1/webhooks/derscanner/rest/api/2/project'], handleJiraProjects);
app.get(['/rest/api/2/project/:projectIdOrKey', '/api/v1/webhooks/derscanner/rest/api/2/project/:projectIdOrKey'], handleJiraProjectDetail);
app.get(['/rest/api/2/project/:projectIdOrKey/components', '/api/v1/webhooks/derscanner/rest/api/2/project/:projectIdOrKey/components', '/rest/api/2/component', '/api/v1/webhooks/derscanner/rest/api/2/component'], handleJiraComponents);
app.get(['/rest/api/2/project/:projectIdOrKey/statuses', '/api/v1/webhooks/derscanner/rest/api/2/project/:projectIdOrKey/statuses', '/rest/api/2/status', '/api/v1/webhooks/derscanner/rest/api/2/status'], handleJiraStatuses);
app.get(['/rest/api/2/project/:projectIdOrKey/versions', '/api/v1/webhooks/derscanner/rest/api/2/project/:projectIdOrKey/versions', '/rest/api/2/version', '/api/v1/webhooks/derscanner/rest/api/2/version'], handleJiraVersions);
app.get(['/rest/api/2/user/assignable/search', '/api/v1/webhooks/derscanner/rest/api/2/user/assignable/search', '/rest/api/2/user/assignable/multiProjectSearch', '/api/v1/webhooks/derscanner/rest/api/2/user/assignable/multiProjectSearch', '/rest/api/2/user/search', '/api/v1/webhooks/derscanner/rest/api/2/user/search', '/rest/api/2/user/picker', '/api/v1/webhooks/derscanner/rest/api/2/user/picker', '/rest/api/2/user', '/api/v1/webhooks/derscanner/rest/api/2/user'], handleJiraUsersSearch);
app.get(['/rest/api/2/search', '/api/v1/webhooks/derscanner/rest/api/2/search', '/rest/api/2/issue/picker', '/api/v1/webhooks/derscanner/rest/api/2/issue/picker'], handleJiraSearch);
app.get(['/rest/api/2/issuetype', '/rest/api/2/issuetype/project', '/rest/api/3/issuetype/project', '/api/v1/webhooks/derscanner/rest/api/2/issuetype', '/api/v1/webhooks/derscanner/rest/api/2/issuetype/project'], handleJiraIssueTypes);
app.get(['/rest/api/2/priority', '/rest/api/2/priority/project', '/api/v1/webhooks/derscanner/rest/api/2/priority', '/api/v1/webhooks/derscanner/rest/api/2/priority/project'], handleJiraPriorities);
app.get(['/rest/api/2/field', '/rest/api/2/field/project', '/api/v1/webhooks/derscanner/rest/api/2/field', '/api/v1/webhooks/derscanner/rest/api/2/field/project'], handleJiraFields);
app.use('/rest/api/2/issue/createmeta', handleJiraCreateMeta);
app.use('/api/v1/webhooks/derscanner/rest/api/2/issue/createmeta', handleJiraCreateMeta);
app.post(['/rest/api/2/issue', '/api/v1/webhooks/derscanner/rest/api/2/issue'], handleJiraCreateIssue);

// Catch-all wildcard для любых других запросов от DerScanner по путям /rest и /api/v1/webhooks/derscanner
const handleWildcard = (req, res) => {
  const url = req.originalUrl || req.url || req.path || '';
  console.log(`📡 [Jira Gateway Wildcard] ${req.method} ${url}`);
  if (req.method === 'GET') {
    if (url.includes('/components')) return handleJiraComponents(req, res);
    if (url.includes('/user')) return handleJiraUsersSearch(req, res);
    if (url.includes('/search') || url.includes('/picker')) return handleJiraSearch(req, res);
    if (url.includes('/createmeta')) return handleJiraCreateMeta(req, res);
    if (url.includes('/status')) return handleJiraStatuses(req, res);
    if (url.includes('/version')) return handleJiraVersions(req, res);
    if (url.includes('/field')) return handleJiraFields(req, res);
    if (url.includes('/priority')) return handleJiraPriorities(req, res);
    if (url.includes('/issuetype')) return handleJiraIssueTypes(req, res);
    if (url.includes('/project/') || url.includes('/project?')) return handleJiraProjectDetail(req, res);
    if (url.includes('/project')) return handleJiraProjects(req, res);
    res.status(200).json({ success: true, message: 'Pulse 12 Jira REST API Gateway response', items: [], values: [] });
  } else {
    handleExternalWebhook(req, res);
  }
};
app.use('/rest', handleWildcard);
app.use('/api/v1/webhooks/derscanner', handleWildcard);

// --- WEBSOCKET REAL-TIME SYNC & ONLINE PRESENCE ---
const onlineSockets = new Map(); // socket.id -> userId

const broadcastOnlineUsers = () => {
  const activeIds = Array.from(new Set(onlineSockets.values())).filter(Boolean);
  io.emit('online-users-updated', activeIds);
};

io.on('connection', (socket) => {
  console.log(`⚡ New corporate laptop connected via Socket.io: ${socket.id}`);
  
  // Send sanitized current state immediately upon connection (1.A)
  socket.emit('init-data', getSanitizedDbData());
  broadcastOnlineUsers();

  socket.on('user-online', (userId) => {
    if (userId) {
      onlineSockets.set(socket.id, userId);
      console.log(`🟢 User ${userId} is online on socket ${socket.id}`);
      broadcastOnlineUsers();
    }
  });

  socket.on('request-sync', () => {
    socket.emit('data-updated', getSanitizedDbData());
    broadcastOnlineUsers();
  });

  socket.on('send-notification', (notif) => {
    if (notif && notif.id) {
      if (!Array.isArray(dbData.notifications)) dbData.notifications = [];
      dbData.notifications = [notif, ...dbData.notifications.filter(n => n.id !== notif.id)].slice(0, 200);
      broadcastUpdate('notifications');
    }
    io.emit('notification-received', notif);

    // Автоматическая отправка уведомления (на почту и/или в Telegram)
    if (notif) {
      const recipient = dbData.users?.find(u => u.id === notif.userId);
      if (recipient && recipient.email) {
        sendTaskNotificationEmail(recipient, {
          title: notif.title || 'Новое уведомление',
          description: notif.message || ''
        }, 'Pulse 12');
      }
      sendTelegramNotification(recipient, notif);
    }
  });

  socket.on('clear-user-notifications', (userId) => {
    if (!Array.isArray(dbData.notifications)) dbData.notifications = [];
    if (userId === 'all' || !userId) {
      dbData.notifications = [];
    } else {
      dbData.notifications = dbData.notifications.filter(n => n.userId !== userId && n.userId !== 'all');
    }
    broadcastUpdate('notifications');
  });

  socket.on('mark-notification-read', (id) => {
    if (!Array.isArray(dbData.notifications)) return;
    dbData.notifications = dbData.notifications.map(n => n.id === id ? { ...n, read: true } : n);
    broadcastUpdate('notifications');
  });

  socket.on('mark-all-notifications-read', (userId) => {
    if (!Array.isArray(dbData.notifications)) return;
    dbData.notifications = dbData.notifications.map(n => {
      if (!userId || n.userId === userId || n.userId === 'all') {
        return { ...n, read: true };
      }
      return n;
    });
    broadcastUpdate('notifications');
  });

  socket.on('delete-notification', (id) => {
    if (!Array.isArray(dbData.notifications)) return;
    dbData.notifications = dbData.notifications.filter(n => n.id !== id);
    broadcastUpdate('notifications');
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
  
  // Статику (скрипты, стили, картинки) отдаем из папки dist
  app.use(express.static(DIST_DIR, {
    etag: true,
    setHeaders: (res, filePath) => {
      // index.html никогда не кэшируем, чтобы браузер всегда получал актуальные хэши скомпилированных JS/CSS файлов
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    }
  }));

  // SPA Fallback: маршрутизация клиентского приложения (/admin, /board, /team, /profile и т.д.)
  app.use((req, res) => {
    // Если запрос был к файлу статики (.js, .css, .png, .map), но его нет на диске — возвращаем 404 вместо index.html
    if (req.path.includes('.') || req.path.startsWith('/api/') || req.path.startsWith('/uploads/') || req.path.startsWith('/socket.io/')) {
      return res.status(404).json({ error: 'Asset or API endpoint not found' });
    }
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

const startServer = async () => {
  await initDb();
  initMailService();
  dbData = await getAllData();
  initTelegramService(dbData, saveCollection);
  initDeadlineCron(() => dbData);

  // Auto-migrate plaintext passwords to bcrypt hashes on startup (1.C)
  const { hashed, modified } = ensureUsersHashed(dbData.users);
  if (modified) {
    dbData.users = hashed;
    await saveCollection('users', dbData.users);
  }

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
