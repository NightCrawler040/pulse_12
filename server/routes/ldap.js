import { saveCollection } from '../db.js';
import express from 'express';
import { testLdapConnection, fetchLdapUsers, syncLdapUsersAndTasks, importSelectedLdapUsers } from '../services/ldapService.js';

export default function createLdapRouter(requireAuth, requireAdmin) {
  const router = express.Router();

  const sanitizeLdapSettings = (settings) => {
    if (!settings || typeof settings !== 'object') return {};
    return { ...settings, bindPassword: settings.bindPassword ? '********' : '' };
  };

  router.get('/settings', requireAdmin, async (req, res) => {
    const settings = req.dbData.ldap_settings || {};
    res.json(sanitizeLdapSettings(settings));
  });

  router.post('/settings', requireAdmin, async (req, res) => {
    const updates = req.body || {};
    const current = req.dbData.ldap_settings || {};
    const isMaskedOrEmpty = updates.bindPassword === '********' || updates.bindPassword === '••••••••' || (/^[•\*]+$/.test(updates.bindPassword || '')) || (!updates.bindPassword && current.bindPassword);
    const bindPassword = isMaskedOrEmpty ? current.bindPassword : updates.bindPassword;

    req.dbData.ldap_settings = {
      ...current,
      ...updates,
      bindPassword
    };
    await saveCollection('ldap_settings', req.dbData.ldap_settings);
    try { await req.broadcastUpdate('ldap_settings'); } catch (e) { return res.status(500).json({ error: 'Database save failed' }); }
    res.json({ success: true, settings: sanitizeLdapSettings(req.dbData.ldap_settings) });
  });

  router.post('/test', requireAdmin, async (req, res) => {
    try {
      const settings = req.body || {};
      const current = req.dbData.ldap_settings || {};
      const isMaskedOrEmpty = settings.bindPassword === '********' || settings.bindPassword === '••••••••' || (/^[•\*]+$/.test(settings.bindPassword || '')) || (!settings.bindPassword && current.bindPassword);
      const testConfig = {
        ...current,
        ...settings,
        bindPassword: isMaskedOrEmpty ? current.bindPassword : settings.bindPassword
      };
      const result = await testLdapConnection(testConfig);
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/sync', requireAdmin, async (req, res) => {
    try {
      const settings = req.body || {};
      const current = req.dbData.ldap_settings || {};
      const isMaskedOrEmpty = settings.bindPassword === '********' || settings.bindPassword === '••••••••' || (/^[•\*]+$/.test(settings.bindPassword || '')) || (!settings.bindPassword && current.bindPassword);
      const syncConfig = {
        ...current,
        ...settings,
        bindPassword: isMaskedOrEmpty ? (current.bindPassword || '') : settings.bindPassword
      };
      const result = await syncLdapUsersAndTasks(req.dbData, saveCollection, syncConfig);
      try { await req.broadcastUpdate('users'); } catch (e) { return res.status(500).json({ error: 'Database save failed' }); }
      try { await req.broadcastUpdate('tasks'); } catch (e) { return res.status(500).json({ error: 'Database save failed' }); }
      res.json({ success: true, report: result });
    } catch (err) {
      console.error('❌ Ошибка синхронизации LDAP:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/preview', requireAdmin, async (req, res) => {
    try {
      const settings = req.body || {};
      const current = req.dbData.ldap_settings || {};
      const isMaskedOrEmpty = settings.bindPassword === '********' || settings.bindPassword === '••••••••' || (/^[•\*]+$/.test(settings.bindPassword || '')) || (!settings.bindPassword && current.bindPassword);
      const previewConfig = {
        ...current,
        ...settings,
        bindPassword: isMaskedOrEmpty ? (current.bindPassword || '') : settings.bindPassword
      };
      const users = await fetchLdapUsers(previewConfig);
      res.json({ success: true, users });
    } catch (err) {
      console.error('❌ Ошибка предпросмотра LDAP:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/import-selected', requireAdmin, async (req, res) => {
    try {
      const { selectedUsers, settings } = req.body || {};
      if (!Array.isArray(selectedUsers) || selectedUsers.length === 0) {
        return res.status(400).json({ success: false, error: 'Не выбрано ни одного сотрудника для импорта' });
      }
      const current = req.dbData.ldap_settings || {};
      const isMaskedOrEmpty = settings?.bindPassword === '********' || settings?.bindPassword === '••••••••' || (/^[•\*]+$/.test(settings?.bindPassword || '')) || (!settings?.bindPassword && current.bindPassword);
      const importConfig = {
        ...current,
        ...settings,
        bindPassword: isMaskedOrEmpty ? (current.bindPassword || '') : (settings?.bindPassword || current.bindPassword)
      };
      const result = await importSelectedLdapUsers(req.dbData, saveCollection, selectedUsers, importConfig);
      try { await req.broadcastUpdate('users'); } catch (e) { return res.status(500).json({ error: 'Database save failed' }); }
      try { await req.broadcastUpdate('tasks'); } catch (e) { return res.status(500).json({ error: 'Database save failed' }); }
      res.json({ success: true, report: result });
    } catch (err) {
      console.error('❌ Ошибка выборочного импорта LDAP:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
