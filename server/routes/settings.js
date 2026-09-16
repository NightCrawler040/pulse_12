import { saveCollection } from '../db.js';
import express from 'express';
import { testMailConnection, rebuildTransporter } from '../services/mailService.js';
import { startImapService } from '../services/imapService.js';

export default function createSettingsRouter(requireAuth, requireAdmin) {
  const router = express.Router();

  router.get('/mail', requireAdmin, async (req, res) => {
    res.json({
      mailSettings: req.dbData.mailSettings || {},
      imapSettings: req.dbData.imapSettings || {},
      notificationEvents: req.dbData.notificationEvents || {}
    });
  });

  router.post('/mail', requireAdmin, async (req, res) => {
    try {
      const { mailSettings, imapSettings, notificationEvents } = req.body;
      req.dbData.mailSettings = { ...(req.dbData.mailSettings || {}), ...mailSettings };
      req.dbData.imapSettings = { ...(req.dbData.imapSettings || {}), ...imapSettings };
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
      await testMailConnection(mailSettings);
      res.json({ success: true, message: 'Тестовое соединение успешно установлено!' });
    } catch (e) {
      res.status(500).json({ error: e.message || 'Ошибка подключения' });
    }
  });

  return router;
}
