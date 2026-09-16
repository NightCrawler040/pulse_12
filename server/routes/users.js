import express from 'express';
import bcrypt from 'bcryptjs';

const hashPasswordIfNeeded = (val) => {
  if (!val) return val;
  const strVal = String(val).trim();
  if (!strVal) return strVal;
  if (strVal.startsWith('$2a$') || strVal.startsWith('$2b$') || strVal.startsWith('$2y$')) return strVal;
  return bcrypt.hashSync(strVal, 10);
};

export default function createUsersRouter(requireAuth, requireAdmin) {
  const router = express.Router();

  // Create new user
  router.post('/', requireAdmin, async (req, res) => {
    const userData = req.body;
    const trimmedEmail = (userData.email || '').trim().toLowerCase();
    const trimmedLogin = (userData.login || trimmedEmail.split('@')[0] || '').trim().toLowerCase();

    // Check for duplicate email or login
    const duplicate = req.dbData.users.find(u => {
      const uEmail = (u.email || '').trim().toLowerCase();
      const uLogin = (u.login || uEmail.split('@')[0] || '').trim().toLowerCase();
      return (trimmedEmail && uEmail === trimmedEmail) || (trimmedLogin && uLogin === trimmedLogin);
    });

    if (duplicate) {
      return res.status(400).json({ error: `Сотрудник с таким email или логином уже зарегистрирован (${duplicate.name})!` });
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
      avatar: userData.avatar || '',
      isActive: true
    };
    req.dbData.users.push(newUser);
    try { 
      await req.broadcastUpdate('users'); 
    } catch (e) { 
      return res.status(500).json({error: 'Database save failed'}); 
    }
    const { password: _, pin: __, ...safeUser } = newUser;
    res.status(201).json(safeUser);
  });

  // Update user
  router.put('/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const updates = { ...req.body };

    // Security checks: IDOR and Mass Assignment / Privilege Escalation protection
    if (req.currentUser?.roleType !== 'admin' && req.currentUser?.id !== id) {
      return res.status(403).json({ error: 'Доступ закрыт: вы не можете редактировать чужой профиль' });
    }
    
    if (req.currentUser?.roleType !== 'admin') {
      delete updates.role;
      delete updates.roleType;
      delete updates.isActive;
    }

    if (updates.email || updates.login) {
      const trimmedEmail = (updates.email || '').trim().toLowerCase();
      const trimmedLogin = (updates.login || trimmedEmail.split('@')[0] || '').trim().toLowerCase();
      const duplicate = req.dbData.users.find(u => {
        if (u.id === id) return false;
        const uEmail = (u.email || '').trim().toLowerCase();
        const uLogin = (u.login || uEmail.split('@')[0] || '').trim().toLowerCase();
        return (trimmedEmail && uEmail === trimmedEmail) || (trimmedLogin && uLogin === trimmedLogin);
      });
      if (duplicate) {
        return res.status(400).json({ error: `Сотрудник с таким email или логином уже существует (${duplicate.name})!` });
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

    req.dbData.users = req.dbData.users.map(u => {
      if (u.id === id) {
        return { ...u, ...updates };
      }
      return u;
    });
    try { 
      await req.broadcastUpdate('users'); 
    } catch (e) { 
      return res.status(500).json({error: 'Database save failed'}); 
    }
    res.json({ success: true });
  });

  // Delete user
  router.delete('/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { permanent } = req.query;

    if (permanent === 'true') {
      req.dbData.users = req.dbData.users.filter(u => u.id !== id);
      if (req.dbData.groups) {
        req.dbData.groups = req.dbData.groups.map(g => ({
          ...g,
          memberIds: (g.memberIds || []).filter(mid => mid !== id)
        }));
      }
      if (req.dbData.tasks) {
        req.dbData.tasks = req.dbData.tasks.map(t => {
          if (t.assigneeId === id) return { ...t, assigneeId: 'unassigned' };
          return t;
        });
      }
    } else {
      req.dbData.users = req.dbData.users.map(u => {
        if (u.id === id) return { ...u, isActive: false };
        return u;
      });
    }

    try { 
      await req.broadcastUpdate(); 
    } catch (e) { 
      return res.status(500).json({error: 'Database save failed'}); 
    }
    res.json({ success: true });
  });

  return router;
}
