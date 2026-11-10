// In-Memory Ring Buffer for Live System Logs in Admin Panel
const MAX_LOGS = 500;
const logBuffer = [];
let isHooked = false;

const detectCategory = (msg) => {
  if (msg.includes('[IMAP]')) return 'IMAP';
  if (msg.includes('[FortiGate')) return 'FortiGate';
  if (msg.includes('[LDAP')) return 'LDAP';
  if (msg.includes('[Jira') || msg.includes('[DerScanner') || msg.includes('[Webhook')) return 'DerScanner/Jira';
  if (msg.includes('[MailService]')) return 'SMTP';
  if (msg.includes('[Security') || msg.includes('🚨')) return 'Security';
  if (msg.includes('[Backup]')) return 'Backup';
  if (msg.includes('[INCOMING HTTP]')) return 'HTTP';
  return 'System';
};

const formatArgs = (args) => {
  return args.map(arg => {
    if (typeof arg === 'string') return arg;
    if (arg instanceof Error) return `${arg.message}\n${arg.stack || ''}`;
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  }).join(' ');
};

export const initLogInterceptor = () => {
  if (isHooked) return;
  isHooked = true;

  const origLog = console.log.bind(console);
  const origWarn = console.warn.bind(console);
  const origError = console.error.bind(console);

  const pushLog = (level, args) => {
    try {
      const message = formatArgs(args);
      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        level,
        category: detectCategory(message),
        message
      };
      logBuffer.push(entry);
      if (logBuffer.length > MAX_LOGS) {
        logBuffer.shift();
      }
    } catch {
      // Ignore logging errors
    }
  };

  console.log = (...args) => {
    pushLog('info', args);
    origLog(...args);
  };

  console.warn = (...args) => {
    pushLog('warn', args);
    origWarn(...args);
  };

  console.error = (...args) => {
    pushLog('error', args);
    origError(...args);
  };
};

export const getSystemLogs = ({ category, level, search, limit = 300 } = {}) => {
  let result = [...logBuffer].reverse(); // Newest first
  if (category && category !== 'all') {
    result = result.filter(l => l.category.toLowerCase() === category.toLowerCase());
  }
  if (level && level !== 'all') {
    result = result.filter(l => l.level === level);
  }
  if (search && String(search).trim()) {
    const q = String(search).trim().toLowerCase();
    result = result.filter(l => l.message.toLowerCase().includes(q) || l.category.toLowerCase().includes(q));
  }
  return result.slice(0, Math.min(Number(limit) || 300, MAX_LOGS));
};

export const clearSystemLogs = () => {
  logBuffer.length = 0;
};
