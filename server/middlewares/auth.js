import crypto from 'crypto';
import { getDbData } from '../store.js';

export const getApiSecret = () => {
  if (process.env.API_SECRET) return process.env.API_SECRET;
  return 'Pulse12_Corporate_Secure_HMAC_Key_2026';
};

export const generateAuthToken = (user) => {
  if (!user || !user.id) return '';
  const secret = getApiSecret();
  const data = `${user.id}:${user.password || ''}:${user.pin || ''}:${secret}`;
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
};

export const requireAuth = async (req, res, next) => {
  const userId = req.headers['x-auth-user'] || (req.body && req.body.userId) || (req.query && req.query.userId);
  if (!userId) {
    return res.status(401).json({ error: 'Доступ к API закрыт: не передан идентификатор пользователя' });
  }
  
  // Use in-memory cache instead of querying DB on every request!
  const dbData = getDbData();
  const user = (dbData.users || []).find(u => u.id === userId && u.isActive !== false);
  
  if (!user) {
    return res.status(401).json({ error: 'Пользователь не найден или заблокирован' });
  }

  const authHeader = req.headers['authorization'] || '';
  const tokenHeader = req.headers['x-api-token'] || (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '');
  if (tokenHeader) {
    const validToken = generateAuthToken(user);
    let isMatch = false;
    if (validToken && tokenHeader.length === validToken.length) {
      try {
        isMatch = crypto.timingSafeEqual(Buffer.from(tokenHeader, 'utf8'), Buffer.from(validToken, 'utf8'));
      } catch (e) {
        isMatch = false;
      }
    }
    if (!isMatch) {
      return res.status(401).json({ error: 'Недействительный цифровой токен подписи API' });
    }
  }

  req.currentUser = user;
  next();
};

export const requireAdmin = (req, res, next) => {
  requireAuth(req, res, () => {
    if (req.currentUser?.roleType !== 'admin') {
      return res.status(403).json({ error: 'Отказано в доступе: требуются права администратора' });
    }
    next();
  });
};
