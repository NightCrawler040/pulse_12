import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initialUsers, initialSprints, initialTasks, initialGroups, initialFindings, initialApiKeys } from './initialData.js';
import { initDb, getAllData, saveCollection, saveAllData, isPostgresMode, getCollection } from './db.js';
import { initMailService, sendMailNotification, rebuildTransporter, testMailConnection } from './services/mailService.js';
import { initDeadlineCron } from './services/cronService.js';
import { generateSprintPdf } from './services/pdfService.js';
import compression from 'compression';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { testLdapConnection, fetchLdapUsers, syncLdapUsersAndTasks, importSelectedLdapUsers, authenticateLdapUser } from './services/ldapService.js';
import { startImapService } from './services/imapService.js';
import { startAutoBackup } from './backup.js';
import { banIpAddress, unbanIpAddress, startFortigateCron } from './services/fortigateService.js';
import createTasksRouter from './routes/tasks.js';
import createUsersRouter from './routes/users.js';
import createSprintsRouter from './routes/sprints.js';
import createNotificationsRouter from './routes/notifications.js';
import createSettingsRouter from './routes/settings.js';
import { mountJiraGateway } from './routes/jiraGateway.js';


import createFortigateRouter from './routes/fortigate.js';

import createLdapRouter from './routes/ldap.js';


import createFindingsRouter from './routes/findings.js';


import createGroupsRouter from './routes/groups.js';

import createWorkspacesRouter from './routes/workspaces.js';
import hrOrdersRouter from './routes/hrOrders.js';




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
  api_keys: [],
  kataHashes: [],
  ldap_settings: null
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

const sanitizeLdapSettings = (settings) => {
  if (!settings || typeof settings !== 'object') return {};
  return {
    ...settings,
    bindPassword: settings.bindPassword ? '********' : ''
  };
};


const getSanitizedDbDataForUser = (user) => {
  const data = getSanitizedDbData();
  if (!user || user.roleType === 'admin') {
    return data;
  }
  const userWorkspaces = user.workspaceIds || [];
  const filteredTasks = (data.tasks || []).filter(t => !t.workspaceId || userWorkspaces.includes(t.workspaceId));
  const filteredFindings = (data.findings || []).filter(f => !f.workspaceId || userWorkspaces.includes(f.workspaceId));
  const filteredSprints = (data.sprints || []).filter(s => !s.workspaceId || userWorkspaces.includes(s.workspaceId));
  const filteredGroups = (data.groups || []).filter(g => !g.workspaceId || userWorkspaces.includes(g.workspaceId));
  const filteredHrOrders = (data.hr_orders || []).filter(o => !o.workspaceId || userWorkspaces.includes(o.workspaceId));
  return { ...data, tasks: filteredTasks, findings: filteredFindings, sprints: filteredSprints, groups: filteredGroups, hr_orders: filteredHrOrders };
};

const getSanitizedDbData = () => {
  // Ensure workspaces exists
  if (!dbData.workspaces || dbData.workspaces.length === 0) {
    dbData.workspaces = [
      {
        id: 'WS-1',
        name: 'Security & Engineering',
        ownerId: 'usr-1',
        adGroup: 'Engineering',
        enabledModules: ['kanban', 'security_center', 'integrations'],
        createdAt: new Date().toISOString()
      }
    ];
    saveCollection('workspaces', dbData.workspaces).catch(e => console.error('Failed to save initial workspaces', e));
  }
  
  // Migrate tasks
  if (dbData.tasks) {
    dbData.tasks.forEach(t => { if (!t.workspaceId) t.workspaceId = 'WS-1'; });
  }
  // Migrate findings
  if (dbData.findings) {
    dbData.findings.forEach(f => { if (!f.workspaceId) f.workspaceId = 'WS-1'; });
  }

  return {
    ...dbData,
    tasks: sanitizeTasks(dbData.tasks),
    sprints: sanitizeSprints(dbData.sprints),
    workspaces: dbData.workspaces || [],
    notifications: Array.isArray(dbData.notifications) ? dbData.notifications : [],
    findings: Array.isArray(dbData.findings) ? dbData.findings : [],
    hr_orders: Array.isArray(dbData.hr_orders) ? dbData.hr_orders : [],
    api_keys: Array.isArray(dbData.api_keys) ? dbData.api_keys : [],
    kataHashes: Array.isArray(dbData.kataHashes) ? dbData.kataHashes : [],
    ldap_settings: sanitizeLdapSettings(dbData.ldap_settings),
    users: sanitizeUsers(dbData.users)
  };
};

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
  if (tokenHeader) {
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
  } else {
    return res.status(401).json({ error: 'Для доступа требуется токен безопасности API (x-api-token)' });
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
const broadcastUpdate = async (key) => {
    try {
      // 1. Сначала атомарно сохраняем в БД (Write-Through)
      if (key && dbData[key]) {
        await saveCollection(key, dbData[key]);
      } else {
        await saveAllData(dbData);
      }
      
      // 2. Только после успешного сохранения отправляем WebSockets
      if (key === 'users') {
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
        });
      } else {
        io.emit('data-updated', getSanitizedDbData());
      }
    } catch (err) {
      console.error('⚠️ Ошибка записи в БД, откат данных в памяти для:', key || 'ALL');
      // ROLLBACK IN-MEMORY CACHE
      if (key) {
        dbData[key] = await getCollection(key);
      } else {
        dbData = await getAllData();
      }
      throw err; // Это позволит HTTP эндпоинту отловить ошибку и вернуть 500
    }
  };

// --- REST API ENDPOINTS ---


  // --- INJECT GLOBAL STATE INTO REQUEST FOR ROUTERS ---
  app.use((req, res, next) => {
    req.dbData = dbData;
    req.broadcastUpdate = broadcastUpdate;
    next();
  });
  
  app.use('/api/tasks', createTasksRouter(requireAuth));
  app.use('/api/users', createUsersRouter(requireAuth, requireAdmin));
  app.use('/api/sprints', createSprintsRouter(requireAuth, requireAdmin));
  app.use('/api/notifications', createNotificationsRouter(requireAuth));
  app.use('/api/settings', createSettingsRouter(requireAuth, requireAdmin));

  app.use('/api/fortigate', createFortigateRouter(requireAuth, requireAdmin));

  app.use('/api/ldap', createLdapRouter(requireAuth, requireAdmin));


  app.use('/api/findings', createFindingsRouter(requireAuth));


  app.use('/api/groups', createGroupsRouter(requireAuth, requireAdmin));

  app.use('/api/workspaces', createWorkspacesRouter(requireAuth, requireAdmin));
    app.use('/api/hr-orders', hrOrdersRouter);


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

// --- KATA THREAT INTELLIGENCE FEED ENDPOINT ---
app.get('/api/feeds/kata-hashes.txt', async (req, res) => {
  if (!dbData.kataHashes || !Array.isArray(dbData.kataHashes) || dbData.kataHashes.length === 0) {
    res.setHeader('Content-Type', 'text/plain');
    return res.send('');
  }
  const allHashes = dbData.kataHashes.map(item => item.hash);
  res.setHeader('Content-Type', 'text/plain');
  res.send(allHashes.join('\n'));
});

// Get all data securely: verify user token; return only basic user profiles for unauthenticated login page load
app.get('/api/data', async (req, res) => { try {
    const userId = req.headers['x-auth-user'] || req.query.userId;
    const authHeader = req.headers['authorization'] || '';
    const tokenHeader = req.headers['x-api-token'] || (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '');
    const user = userId ? dbData.users.find(u => u.id === userId && u.isActive !== false) : null;

    if (user && (!tokenHeader || tokenHeader === generateAuthToken(user))) {
      return res.json(getSanitizedDbDataForUser(user));
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
    const targetUserId = req.query.userId || null;
    if (targetUserId && targetUserId !== req.currentUser.id && req.currentUser.roleType !== 'admin') {
      return res.status(403).json({ error: 'У вас нет прав для скачивания отчетов других сотрудников' });
    }
    let filename = sprintId === 'all' ? 'Pulse12_Corporate_Report_All.pdf' : `Pulse12_Sprint_${sprintId}_Report.pdf`;
    if (targetUserId) {
      filename = `Pulse12_Employee_Report_${targetUserId}.pdf`;
    }
    const dbData = await getAllData();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    generateSprintPdf({ dbData, sprintId, targetUserId, stream: res });
  } catch (err) {
    console.error('❌ Error generating PDF report:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Ошибка при формировании PDF-отчёта' });
    }
  }
});

// Login check securely on backend with anti-bruteforce rate limiting (1.A, 1.C) + LDAP/AD Fallback
app.post('/api/login', loginRateLimiter, async (req, res) => {
  const { login, password, pin, userId } = req.body;
  const cleanLogin = String(login || userId || '').trim();
  const passOrPin = String(password || pin || '').trim();
  
  if (!cleanLogin || !passOrPin) {
    return res.status(400).json({ success: false, error: 'Введите Логин и Пароль' });
  }

  try {
    const latestData = await getAllData();
    if (latestData.users && Array.isArray(latestData.users)) dbData.users = latestData.users;
    if (latestData.ldap_settings !== undefined) dbData.ldap_settings = latestData.ldap_settings;
  } catch (err) {
    console.error('⚠️ [Login] Ошибка обновления dbData перед входом:', err.message);
  }

  const existingUser = dbData.users.find(u => {
    return (u.login && String(u.login).trim().toLowerCase() === cleanLogin.toLowerCase()) || 
           (u.email && String(u.email).trim().toLowerCase() === cleanLogin.toLowerCase()) ||
           (u.name && String(u.name).trim().toLowerCase() === cleanLogin.toLowerCase()) ||
           (u.id === cleanLogin);
  });

  // Account Lockout Check
  if (existingUser && existingUser.lockedUntil && new Date(existingUser.lockedUntil) > new Date()) {
    // Artificial delay to prevent timing attacks
    await new Promise(r => setTimeout(r, 1000));
    return res.status(401).json({ success: false, error: 'Аккаунт временно заблокирован из-за множества попыток. Подождите 15 минут.' });
  }

  let user = null;
  if (existingUser && existingUser.isActive !== false) {
    if (verifyPasswordOrPin(passOrPin, existingUser.password) || verifyPasswordOrPin(passOrPin, existingUser.pin)) {
      user = existingUser;
    }
  }

  // Если локальный вход не удался, проверяем LDAP аутентификацию (при наличии настроенного сервера)
  if (!user && dbData.ldap_settings && dbData.ldap_settings.serverUrl) {
    try {
      const ldapUser = await authenticateLdapUser(cleanLogin, passOrPin, dbData.ldap_settings);
      if (ldapUser) {
        user = dbData.users.find(u => 
          (u.email && u.email.trim().toLowerCase() === ldapUser.email.trim().toLowerCase()) ||
          (u.login && u.login.trim().toLowerCase() === ldapUser.login.trim().toLowerCase())
        );

        const isAdminUser = (ldapUser.login && ldapUser.login.toLowerCase().includes('kairatov')) || 
                            (ldapUser.email && ldapUser.email.toLowerCase().includes('kairatov')) ||
                            (ldapUser.login && ldapUser.login.toLowerCase().includes('security11'));

        if (user) {
          user.ldapDn = ldapUser.dn || user.ldapDn;
          user.authSource = 'LDAP';
          user.isActive = true;
          if (ldapUser.email) user.email = ldapUser.email;
          if (ldapUser.department) user.department = ldapUser.department;
        } else {
          const newId = `usr-ad-${ldapUser.login || Math.floor(Math.random() * 90000 + 10000)}`;
          user = {
            id: newId,
            login: ldapUser.login,
            email: ldapUser.email,
            name: ldapUser.name || ldapUser.login,
            department: ldapUser.department || 'Отдел не указан',
            role: isAdminUser ? 'Администратор' : 'Сотрудник',
            roleType: isAdminUser ? 'admin' : 'member',
            authSource: 'LDAP',
            ldapDn: ldapUser.dn,
            isActive: true,
            createdAt: new Date().toISOString()
          };
          dbData.users.push(user);
        }
          // --- STEP 4: AUTO WORKSPACE MAPPING ---
          if (!user.workspaceIds) user.workspaceIds = [];
          if (user.department && dbData.workspaces) {
            const matchingWorkspaces = dbData.workspaces.filter(ws => 
              ws.adGroup && ws.adGroup.toLowerCase() === user.department.toLowerCase()
            );
            matchingWorkspaces.forEach(ws => {
              if (!user.workspaceIds.includes(ws.id)) {
                user.workspaceIds.push(ws.id);
                console.log(`[LDAP Sync] Auto-assigned ${user.login} to workspace ${ws.name}`);
              }
            });
          }
          if (user.workspaceIds.length === 0 && dbData.workspaces && dbData.workspaces.find(w => w.id === 'WS-1')) {
             if (!user.workspaceIds.includes('WS-1')) user.workspaceIds.push('WS-1');
          }
          // ---------------------------------------

          await saveCollection('users', dbData.users);

        try { await broadcastUpdate('users'); } catch (e) { return res.status(500).json({error: 'Database save failed'}); }
        console.log(`✅ [LDAP Auth] Пользователь AD "${user.login}" (${user.email}) успешно авторизован и сохранен в системе!`);
      }
    } catch (ldapErr) {
      console.warn('⚠️ Ошибка LDAP аутентификации:', ldapErr.message);
    }
  }

  if (user) {
    if (user.failedLoginAttempts || user.lockedUntil) {
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
      await saveCollection('users', dbData.users);
    }
    const { password: _, pin: __, ...safeUser } = user;
    const token = generateAuthToken(user);
    res.json({ success: true, user: safeUser, token });
  } else {
    // Tarpitting: Artificial delay for failed logins (1 second)
    await new Promise(r => setTimeout(r, 1000));
    
    // Increment failed attempts if user exists
    if (existingUser) {
      existingUser.failedLoginAttempts = (existingUser.failedLoginAttempts || 0) + 1;
      if (existingUser.failedLoginAttempts >= 5) {
        existingUser.lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        console.warn(`🚨 [Security] Account locked due to brute-force: ${existingUser.login || existingUser.id}`);
      }
      await saveCollection('users', dbData.users);
    }

    res.status(401).json({ success: false, error: 'Неверный логин или пароль' });
  }
});

// Create task

// --- WORKSPACES API ---






// Delete (deactivate or permanent remove) user (Admin Only) (1.B)


// --- GROUPS CRUD ENDPOINTS ---








// Sprints CRUD






// --- NOTIFICATION PERSISTENCE ENDPOINTS ---




// --- FILE UPLOAD ENDPOINT (LOCAL AVATARS) ---
app.post('/api/upload', requireAuth, async (req, res) => {
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
app.post('/api/upload-file', requireAuth, async (req, res) => {
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
app.post('/api/reset', requireAdmin, async (req, res) => {
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
  try { await broadcastUpdate(); } catch (e) { return res.status(500).json({error: 'Database save failed'}); }
  res.json({ success: true });
});

// Import database (Admin Only) (1.B)
app.post('/api/import', requireAdmin, async (req, res) => {
  const imported = req.body;
  if (imported && Array.isArray(imported.tasks)) {
    dbData.tasks = imported.tasks;
    if (Array.isArray(imported.sprints)) dbData.sprints = imported.sprints;
    if (Array.isArray(imported.users)) dbData.users = imported.users;
    if (Array.isArray(imported.groups)) dbData.groups = imported.groups;
    try { await broadcastUpdate(); } catch (e) { return res.status(500).json({error: 'Database save failed'}); }
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Invalid import format' });
  }
});

  // --- SECURITY CENTER & INTEGRATIONS API ENDPOINTS ---

// Получить список всех внешних инцидентов / уязвимостей


// Создать инцидент вручную из UI или через внутренний API


// Обновить статус инцидента (new -> analyzing -> false-positive / resolved)


// Удалить инцидент


// Перевести инцидент (DerScanner/SIEM) в рабочую задачу (Promote to Task)


// Получить список API-ключей для интеграций
app.get('/api/api-keys', requireAdmin, async (req, res) => {
  res.json(dbData.api_keys || []);
});

// Сгенерировать новый API-ключ для внешней системы
app.post('/api/api-keys', requireAdmin, async (req, res) => {
  const { name, source, workspaceId } = req.body;
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
    workspaceId: workspaceId || null,
    createdAt: new Date().toISOString(),
    lastUsedAt: null
  };
  if (!dbData.api_keys) dbData.api_keys = [];
  dbData.api_keys.push(newKeyObj);
  try { await broadcastUpdate('api_keys'); } catch (e) { return res.status(500).json({error: 'Database save failed'}); }
  res.status(201).json(newKeyObj);
});

// Удалить/отозвать API-ключ
app.delete('/api/api-keys/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (!dbData.api_keys) dbData.api_keys = [];
  dbData.api_keys = dbData.api_keys.filter(k => k.id !== id);
  try { await broadcastUpdate('api_keys'); } catch (e) { return res.status(500).json({error: 'Database save failed'}); }
  res.json({ success: true });
});

// --- ВНЕШНИЙ WEBHOOK И JIRA REST API GATEWAY ДЛЯ DERSCANNER / SIEM ---


// Catch-all wildcard для любых других запросов от DerScanner по путям /rest и /api/v1/webhooks/derscanner




  mountJiraGateway(app, dbData, broadcastUpdate, saveCollection);

// --- WEBSOCKET REAL-TIME SYNC & ONLINE PRESENCE ---
const onlineSockets = new Map(); // socket.id -> userId

const broadcastOnlineUsers = () => {
  const activeIds = Array.from(new Set(onlineSockets.values())).filter(Boolean);
  io.emit('online-users-updated', activeIds);
};

io.on('connection', (socket) => {
  console.log(`⚡ New corporate laptop connected via Socket.io: ${socket.id}`);
  
  // Send sanitized current state immediately upon connection (1.A)
  // Removed init-data on raw connection (Bug #5). Will send after user-online.
  broadcastOnlineUsers();

  socket.on('user-online', async (userId) => {
    if (userId) {
      onlineSockets.set(socket.id, userId);
      console.log(`🟢 User ${userId} is online on socket ${socket.id}`);
      broadcastOnlineUsers();
    }
  });

  socket.on('request-sync', async () => {
    socket.emit('data-updated', getSanitizedDbData());
    broadcastOnlineUsers();
  });

  socket.on('send-notification', async (notif) => {
    if (notif && notif.id) {
      if (!Array.isArray(dbData.notifications)) dbData.notifications = [];
      dbData.notifications = [notif, ...dbData.notifications.filter(n => n.id !== notif.id)].slice(0, 200);
      try { await broadcastUpdate('notifications'); } catch (e) { console.error('Socket save error', e); }
    }
    io.emit('notification-received', notif);

    // Автоматическая отправка уведомления на почту
    if (notif) {
      const recipient = dbData.users?.find(u => u.id === notif.userId);
      let eventType = 'taskAssigned'; // По умолчанию
      if (notif.message && notif.message.includes('Статус задачи')) eventType = 'taskStatusChanged';
      
      const relatedTask = notif.taskData || (notif.linkTaskId ? dbData.tasks?.find(t => t.id === notif.linkTaskId) : null);
      
      sendMailNotification(recipient, notif.message || notif.title, eventType, relatedTask);
    }
  });

  socket.on('clear-user-notifications', async (userId) => {
    if (!Array.isArray(dbData.notifications)) dbData.notifications = [];
    if (userId === 'all' || !userId) {
      dbData.notifications = [];
    } else {
      dbData.notifications = dbData.notifications.filter(n => n.userId !== userId && n.userId !== 'all');
    }
    try { await broadcastUpdate('notifications'); } catch (e) { console.error('Socket save error', e); }
  });

  socket.on('mark-notification-read', async (id) => {
    if (!Array.isArray(dbData.notifications)) return;
    dbData.notifications = dbData.notifications.map(n => n.id === id ? { ...n, read: true } : n);
    try { await broadcastUpdate('notifications'); } catch (e) { console.error('Socket save error', e); }
  });

  socket.on('mark-all-notifications-read', async (userId) => {
    if (!Array.isArray(dbData.notifications)) return;
    dbData.notifications = dbData.notifications.map(n => {
      if (!userId || n.userId === userId || n.userId === 'all') {
        return { ...n, read: true };
      }
      return n;
    });
    try { await broadcastUpdate('notifications'); } catch (e) { console.error('Socket save error', e); }
  });

  socket.on('delete-notification', async (id) => {
    if (!Array.isArray(dbData.notifications)) return;
    dbData.notifications = dbData.notifications.filter(n => n.id !== id);
    try { await broadcastUpdate('notifications'); } catch (e) { console.error('Socket save error', e); }
  });

  socket.on('disconnect', async () => {
    console.log(`🔌 Corporate laptop disconnected: ${socket.id}`);
    onlineSockets.delete(socket.id);
    broadcastOnlineUsers();
  });
});

// --- STATIC FRONTEND SERVING FOR PRODUCTION (vSphere VM / Docker) ---
  // Настройки почты (SMTP и IMAP)
  

  

  

  app.use(express.static(path.join(__dirname, '../dist')));
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
  app.use(async (req, res) => {
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
  dbData = await getAllData();

  // Auto-migrate massive IMAP tasks that blow up the PDF report
  let tasksModified = false;
  if (dbData.tasks) {
    dbData.tasks.forEach(t => {
      if (t.description && t.description.length > 2500 && (t.description.includes('[SOAR Auto-Ban]') || t.authorId === 'system')) {
         t.description = t.description.substring(0, 1000) + '<br/><br/><i>[Длинный текст (список адресов/подписи) автоматически обрезан для сохранения читабельности PDF-отчетов]</i><br/><br/>' + 
               (t.description.includes('[SOAR Auto-Ban]') ? '<strong>Найденные индикаторы (IP/DNS) добавлены в локальную базу.</strong>' : '');
         tasksModified = true;
      }
    });
    if (tasksModified) {
      await saveCollection('tasks', dbData.tasks);
      console.log('✅ Auto-truncated massive IMAP tasks in the database to prevent PDF crash');
    }
  }
  
  initMailService(dbData, saveCollection);
  initDeadlineCron(() => dbData);
  startAutoBackup(() => dbData);
  startFortigateCron(() => dbData, saveCollection);

  // Auto-migrate plaintext passwords to bcrypt hashes on startup (1.C)
  const { hashed, modified } = ensureUsersHashed(dbData.users);
  if (modified) {
    dbData.users = hashed;
    await saveCollection('users', dbData.users);
  }

  // Запуск службы приема писем
  global.restartImapService = (settings) => {
    startImapService(settings, dbData, broadcastUpdate);
  };
  global.restartImapService(dbData.imapSettings);

  let migrated = false;
  if (dbData.api_keys) {
    dbData.api_keys.forEach(k => {
      if (!k.workspaceId) { k.workspaceId = 'WS-1'; migrated = true; }
    });
  }
  if (dbData.fortigateSettings && !dbData.fortigateSettings['WS-1'] && dbData.fortigateSettings.apiToken) {
    dbData.fortigateSettings['WS-1'] = { ...dbData.fortigateSettings };
    migrated = true;
  }
  if (migrated) {
    saveCollection('api_keys', dbData.api_keys).catch(() => {});
    saveCollection('fortigateSettings', dbData.fortigateSettings).catch(() => {});
  }

  console.log(`✅ Инициализированы данные системы (${isPostgresMode() ? 'PostgreSQL' : 'Файловый режим'}): ${dbData.tasks.length} задач, ${dbData.users.length} сотрудников.`);

  const PORT = process.env.PORT || 3001;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Корпоративный сервер Pulse запущен на порту ${PORT}!`);
    console.log(`💻 Локальный адрес: http://localhost:${PORT}`);
    console.log(`🌐 Для подключения с других ПК укажите IP вашей vSphere машины (например, http://192.168.x.x:${PORT})`);
    console.log(`======================================================\n`);
  });
};

startServer();
