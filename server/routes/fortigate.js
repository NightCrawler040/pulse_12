import express from 'express';
import { banIpAddress, unbanIpAddress } from '../services/fortigateService.js';

export default function createFortigateRouter(requireAuth, requireAdmin) {
  const router = express.Router();

  router.get('/settings', requireAdmin, async (req, res) => {
    const { workspaceId } = req.query;
    if (!req.dbData.fortigateSettings) req.dbData.fortigateSettings = {};
    const settings = workspaceId ? (req.dbData.fortigateSettings[workspaceId] || {}) : (req.dbData.fortigateSettings || {});
    res.json({
      ...settings,
      apiToken: settings.apiToken ? '********' : ''
    });
  });

  router.post('/settings', requireAdmin, async (req, res) => {
    
    const { workspaceId, ...updates } = req.body || {};
    if (!req.dbData.fortigateSettings) req.dbData.fortigateSettings = {};
    
    const current = workspaceId ? (req.dbData.fortigateSettings[workspaceId] || {}) : (req.dbData.fortigateSettings || {});
    const isMaskedOrEmpty = updates.apiToken === '********' || updates.apiToken === '••••••••' || (/^[•\\*]+$/.test(updates.apiToken || '')) || (!updates.apiToken && current.apiToken);
    const apiToken = isMaskedOrEmpty ? current.apiToken : updates.apiToken;
  
    if (workspaceId) {
      req.dbData.fortigateSettings[workspaceId] = { ...current, ...updates, apiToken };
    } else {
      req.dbData.fortigateSettings = { ...current, ...updates, apiToken };
    }
    await saveCollection('fortigateSettings', req.dbData.fortigateSettings);
    const updatedSettings = workspaceId ? req.dbData.fortigateSettings[workspaceId] : req.dbData.fortigateSettings;
    res.json({ success: true, settings: { ...updatedSettings, apiToken: updatedSettings.apiToken ? '********' : '' } });
  });

  router.post('/test', requireAdmin, async (req, res) => {
    
    const { workspaceId } = req.body || {};
    const current = workspaceId && req.dbData.fortigateSettings ? (req.dbData.fortigateSettings[workspaceId] || {}) : (req.dbData.fortigateSettings || {});
  if (!current.enabled || !current.banUrl || !current.apiToken) {
    return res.status(400).json({ success: false, error: 'Интеграция не настроена или нет URL/токена.' });
  }
  try {
    const testIp = '1.1.1.1';
    const success = await banIpAddress(current, testIp);
    if (success) {
      if (current.unbanUrl) {
        await unbanIpAddress(current, testIp);
      }
      res.json({ success: true, message: 'Тестовый IP заблокирован и разблокирован в FortiGate.' });
    } else {
      res.status(500).json({ success: false, error: 'FortiGate вернул ошибку при блокировке.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

  router.get('/banned-ips', requireAdmin, async (req, res) => {
    
    res.json({ success: true, bannedIps: req.dbData.bannedIps || [] });
  });

  router.post('/ban', requireAdmin, async (req, res) => {
    
    const { ip, expiresAt, isPermanent, workspaceId } = req.body;
    if (!ip) return res.status(400).json({ success: false, error: 'IP адрес не указан' });
    const settings = workspaceId && req.dbData.fortigateSettings ? (req.dbData.fortigateSettings[workspaceId] || {}) : (req.dbData.fortigateSettings || {});
    try {
      let success = true;
      if (settings.enabled && settings.banUrl) {
        success = await banIpAddress(settings, ip);
      }
      
      if (success) {
        if (!req.dbData.bannedIps) req.dbData.bannedIps = [];
        // Remove if already exists
        req.dbData.bannedIps = req.dbData.bannedIps.filter(b => b.ip !== ip);
        
        let finalExpiresAt = expiresAt;
        if (isPermanent) {
           finalExpiresAt = Date.now() + 100 * 365 * 24 * 60 * 60 * 1000;
        } else if (!finalExpiresAt) {
           const banDuration = settings.banDurationDays || 90;
           finalExpiresAt = Date.now() + (banDuration * 24 * 60 * 60 * 1000);
        }

        const newBan = { ip, bannedAt: Date.now(), expiresAt: finalExpiresAt, isPermanent: !!isPermanent };
        req.dbData.bannedIps.push(newBan);
        await saveCollection('bannedIps', req.dbData.bannedIps);
        
        res.json({ success: true, message: `IP ${ip} успешно заблокирован`, banRecord: newBan });
      } else {
        res.status(500).json({ success: false, error: 'FortiGate вернул ошибку при блокировке' });
      }
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/unban', requireAdmin, async (req, res) => {
    
    const { ip, workspaceId } = req.body;
    if (!ip) return res.status(400).json({ success: false, error: 'IP адрес не указан' });
    const settings = workspaceId && req.dbData.fortigateSettings ? (req.dbData.fortigateSettings[workspaceId] || {}) : (req.dbData.fortigateSettings || {});
    try {
      let success = true;
      if (settings.enabled && settings.unbanUrl) {
        success = await unbanIpAddress(settings, ip);
      }
      
      if (success) {
        if (req.dbData.bannedIps) {
          req.dbData.bannedIps = req.dbData.bannedIps.filter(b => b.ip !== ip);
          await saveCollection('bannedIps', req.dbData.bannedIps);
        }
        res.json({ success: true, message: `IP ${ip} успешно разблокирован` });
      } else {
        res.status(500).json({ success: false, error: 'FortiGate вернул ошибку при попытке разблокировки' });
      }
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
