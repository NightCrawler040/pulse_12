import { saveCollection } from '../db.js';
import express from 'express';
import { banIpAddress, unbanIpAddress, allocateFortigateGroup } from '../services/fortigateService.js';

const DEFAULT_TEMP_GROUPS = [
  'Malicious IP.s KZ-CERT Pulse_1',
  'Malicious IP.s KZ-CERT Pulse_2',
  'Malicious IP.s KZ-CERT Pulse_3'
];

function computeGroupCapacities(bannedIps = []) {
  const capacities = {};
  for (const item of bannedIps) {
    const grp = item.fortigateGroup || 'Malicious IP.s KZ-CERT Pulse_1';
    capacities[grp] = (capacities[grp] || 0) + 1;
  }
  return capacities;
}

export default function createFortigateRouter(requireAuth, requireAdmin) {
  const router = express.Router();

  router.get('/settings', requireAdmin, async (req, res) => {
    const { workspaceId } = req.query;
    if (!req.dbData.fortigateSettings) req.dbData.fortigateSettings = {};
    const rawSettings = workspaceId
      ? (req.dbData.fortigateSettings[workspaceId] || req.dbData.fortigateSettings || {})
      : (req.dbData.fortigateSettings['WS-1'] || req.dbData.fortigateSettings || {});

    const tempGroups = (Array.isArray(rawSettings.tempGroups) && rawSettings.tempGroups.length > 0)
      ? rawSettings.tempGroups
      : DEFAULT_TEMP_GROUPS;

    res.json({
      enabled: !!rawSettings.enabled,
      autoBanEnabled: !!rawSettings.autoBanEnabled,
      banUrl: rawSettings.banUrl || '',
      unbanUrl: rawSettings.unbanUrl || '',
      banDurationDays: rawSettings.banDurationDays || 90,
      addressGroup: rawSettings.addressGroup || DEFAULT_TEMP_GROUPS[0],
      tempGroups,
      permGroup: rawSettings.permGroup || 'Pulse_Perm',
      maxPerGroup: rawSettings.maxPerGroup || 600,
      groupCapacities: computeGroupCapacities(req.dbData.bannedIps || []),
      apiToken: rawSettings.apiToken ? '********' : ''
    });
  });

  router.post('/settings', requireAdmin, async (req, res) => {
    const { workspaceId, groupCapacities, ...updates } = req.body || {};
    if (!req.dbData.fortigateSettings) req.dbData.fortigateSettings = {};

    const current = workspaceId
      ? (req.dbData.fortigateSettings[workspaceId] || req.dbData.fortigateSettings || {})
      : (req.dbData.fortigateSettings['WS-1'] || req.dbData.fortigateSettings || {});
    const isMaskedOrEmpty =
      updates.apiToken === '********' ||
      updates.apiToken === '••••••••' ||
      /^[•\*]+$/.test(updates.apiToken || '') ||
      (!updates.apiToken && current.apiToken);
    const apiToken = isMaskedOrEmpty ? current.apiToken : updates.apiToken;

    const merged = {
      ...current,
      ...updates,
      tempGroups: (Array.isArray(updates.tempGroups) && updates.tempGroups.length > 0)
        ? updates.tempGroups
        : (current.tempGroups || DEFAULT_TEMP_GROUPS),
      permGroup: updates.permGroup || current.permGroup || 'Pulse_Perm',
      maxPerGroup: Number(updates.maxPerGroup) || current.maxPerGroup || 600,
      apiToken
    };

    if (workspaceId) {
      req.dbData.fortigateSettings[workspaceId] = merged;
    } else {
      req.dbData.fortigateSettings = { ...req.dbData.fortigateSettings, ...merged };
      if (req.dbData.fortigateSettings['WS-1']) {
        req.dbData.fortigateSettings['WS-1'] = merged;
      }
    }
    await saveCollection('fortigateSettings', req.dbData.fortigateSettings);

    res.json({
      success: true,
      settings: {
        ...merged,
        groupCapacities: computeGroupCapacities(req.dbData.bannedIps || []),
        apiToken: merged.apiToken ? '********' : ''
      }
    });
  });

  router.post('/test', requireAdmin, async (req, res) => {
    const { workspaceId } = req.body || {};
    const current = workspaceId && req.dbData.fortigateSettings
      ? (req.dbData.fortigateSettings[workspaceId] || req.dbData.fortigateSettings || {})
      : (req.dbData.fortigateSettings?.['WS-1'] || req.dbData.fortigateSettings || {});
    if (!current.enabled || !current.banUrl || !current.apiToken) {
      return res.status(400).json({ success: false, error: 'Интеграция не настроена или нет URL/токена.' });
    }
    try {
      const testIp = '1.1.1.1';
      const testGroup = (Array.isArray(current.tempGroups) && current.tempGroups[0]) || current.permGroup || DEFAULT_TEMP_GROUPS[0];
      const success = await banIpAddress(current, testIp, testGroup);
      if (success) {
        if (current.unbanUrl) {
          await unbanIpAddress(current, testIp, testGroup);
        }
        res.json({ success: true, message: `Тестовый IP ${testIp} заблокирован (группа: ${testGroup}) и разблокирован в FortiGate.` });
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
    const settings = workspaceId && req.dbData.fortigateSettings
      ? (req.dbData.fortigateSettings[workspaceId] || req.dbData.fortigateSettings || {})
      : (req.dbData.fortigateSettings?.['WS-1'] || req.dbData.fortigateSettings || {});
    try {
      let success = true;
      const assignedGroup = allocateFortigateGroup(req.dbData.bannedIps || [], isPermanent, settings);
      if (settings.enabled && settings.banUrl) {
        success = await banIpAddress(settings, ip, assignedGroup);
      }

      if (success) {
        if (!req.dbData.bannedIps) req.dbData.bannedIps = [];
        req.dbData.bannedIps = req.dbData.bannedIps.filter(b => b.ip !== ip);

        let finalExpiresAt = expiresAt;
        if (isPermanent) {
          finalExpiresAt = Date.now() + 100 * 365 * 24 * 60 * 60 * 1000;
        } else if (!finalExpiresAt) {
          const banDuration = settings.banDurationDays || 90;
          finalExpiresAt = Date.now() + (banDuration * 24 * 60 * 60 * 1000);
        }

        const newBan = { ip, bannedAt: Date.now(), expiresAt: finalExpiresAt, isPermanent: !!isPermanent, fortigateGroup: assignedGroup };
        req.dbData.bannedIps.push(newBan);
        await saveCollection('bannedIps', req.dbData.bannedIps);

        res.json({ success: true, message: `IP ${ip} успешно заблокирован (группа: ${assignedGroup})`, banRecord: newBan });
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
    const settings = workspaceId && req.dbData.fortigateSettings
      ? (req.dbData.fortigateSettings[workspaceId] || req.dbData.fortigateSettings || {})
      : (req.dbData.fortigateSettings?.['WS-1'] || req.dbData.fortigateSettings || {});
    try {
      let success = true;
      const banRecord = (req.dbData.bannedIps || []).find(b => b.ip === ip);
      const groupToUnban = banRecord?.fortigateGroup || DEFAULT_TEMP_GROUPS[0];
      if (settings.enabled && settings.unbanUrl) {
        success = await unbanIpAddress(settings, ip, groupToUnban);
      }

      if (success) {
        if (req.dbData.bannedIps) {
          req.dbData.bannedIps = req.dbData.bannedIps.filter(b => b.ip !== ip);
          await saveCollection('bannedIps', req.dbData.bannedIps);
        }
        res.json({ success: true, message: `IP ${ip} успешно разблокирован` });
      } else {
        res.status(500).json({ success: false, error: 'FortiGate вернул ошибку при разблокировке' });
      }
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
