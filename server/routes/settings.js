import { saveCollection } from '../db.js';
import express from 'express';
import { testMailConnection, rebuildTransporter } from '../services/mailService.js';
import { getSystemLogs, clearSystemLogs } from '../services/logService.js';

const isMaskedPass = (val) => val === '********' || val === '••••••••' || (/^[•\*]+$/.test(val || ''));

export default function createSettingsRouter(requireAuth, requireAdmin) {
  const router = express.Router();

  router.get('/logs', requireAdmin, async (req, res) => {
    const { category, level, search, limit } = req.query;
    res.json({ logs: getSystemLogs({ category, level, search, limit }) });
  });

  router.delete('/logs', requireAdmin, async (req, res) => {
    clearSystemLogs();
    res.json({ success: true });
  });

  router.get('/global', async (req, res) => {
    res.json(req.dbData.globalSettings || { theme: 'dark-matte' });
  });

  router.post('/global', requireAdmin, async (req, res) => {
    try {
      const { theme } = req.body;
      req.dbData.globalSettings = { ...(req.dbData.globalSettings || {}), theme };
      await req.broadcastUpdate('globalSettings');
      res.json({ success: true, settings: req.dbData.globalSettings });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Save failed' });
    }
  });

  router.get('/mail', requireAdmin, async (req, res) => {
    const ms = req.dbData.mailSettings || {};
    const ims = req.dbData.imapSettings || {};
    res.json({
      mailSettings: { ...ms, password: ms.password ? '********' : '' },
      imapSettings: { ...ims, password: ims.password ? '********' : '' },
      notificationEvents: req.dbData.notificationEvents || {}
    });
  });

  router.post('/mail', requireAdmin, async (req, res) => {
    try {
      const { mailSettings, imapSettings, notificationEvents } = req.body;
      const curMail = req.dbData.mailSettings || {};
      const curImap = req.dbData.imapSettings || {};

      const nextMail = { ...curMail, ...(mailSettings || {}) };
      if (mailSettings && (isMaskedPass(mailSettings.password) || (!mailSettings.password && curMail.password))) {
        nextMail.password = curMail.password;
      }

      const nextImap = { ...curImap, ...(imapSettings || {}) };
      if (imapSettings && (isMaskedPass(imapSettings.password) || (!imapSettings.password && curImap.password))) {
        nextImap.password = curImap.password;
      }

      req.dbData.mailSettings = nextMail;
      req.dbData.imapSettings = nextImap;
      req.dbData.notificationEvents = { ...(req.dbData.notificationEvents || {}), ...notificationEvents };
      
      await saveCollection('mailSettings', req.dbData.mailSettings);
      await saveCollection('imapSettings', req.dbData.imapSettings);
      await saveCollection('notificationEvents', req.dbData.notificationEvents);
      
      rebuildTransporter(req.dbData.mailSettings);
      
      // Перезапускаем IMAP сервис при изменении настроек
      if (global.restartImapService) {
        global.restartImapService(req.dbData.imapSettings);
      }

      res.json({ success: true, message: 'Настройки почты сохранены' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/mail/test', requireAdmin, async (req, res) => {
    try {
      const { mailSettings } = req.body;
      const curMail = req.dbData.mailSettings || {};
      const testCfg = { ...curMail, ...(mailSettings || {}) };
      if (mailSettings && (isMaskedPass(mailSettings.password) || (!mailSettings.password && curMail.password))) {
        testCfg.password = curMail.password;
      }
      await testMailConnection(testCfg);
      res.json({ success: true, message: 'Тестовое соединение успешно установлено!' });
    } catch (e) {
      res.status(500).json({ error: e.message || 'Ошибка подключения' });
    }
  });

  router.get('/hr', requireAdmin, async (req, res) => {
    res.json({ hrSettings: req.dbData.hrSettings || { workspaceId: 'WS-1', groupId: null } });
  });

  router.post('/hr', requireAdmin, async (req, res) => {
    try {
      const { hrSettings } = req.body;
      req.dbData.hrSettings = hrSettings;
      await saveCollection('hrSettings', hrSettings);
      res.json({ success: true, message: 'Настройки HR Приказов сохранены' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}
