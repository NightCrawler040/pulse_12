import { saveCollection } from '../db.js';
import express from 'express';
import { testMailConnection, rebuildTransporter } from '../services/mailService.js';
import { getSystemLogs, clearSystemLogs } from '../services/logService.js';
import { createSnapshot, listSnapshots, readSnapshotFile } from '../backup.js';

const isMaskedPass = (val) => val === '********' || val === '••••••••' || (/^[•\*]+$/.test(val || ''));

const DEFAULT_DKB_ARCHITECTURE = {
  title: 'Интерактивная карта архитектуры и потоков данных ДКБ (Pulse12 SOAR & SecOps)',
  updatedAt: new Date().toISOString(),
  nodes: [
    {
      id: 'node-kzcert',
      title: 'KZ-CERT / Внешние бюллетени',
      subtitle: 'Поток индикаторов компрометации (IoC)',
      category: 'source',
      icon: 'mail',
      color: '#38bdf8',
      ipOrHost: 'IMAP / TLS 993',
      owner: 'Отдел мониторинга и реагирования ИБ',
      x: 60,
      y: 70,
      description: 'Входящие письма и бюллетени информационной безопасности от НКЦК / KZ-CERT и партнеров. Содержат списки вредоносных IP-адресов, доменных имен (DNS), URL и файловых хэшей (MD5, SHA-1, SHA-256), а также сроки блокировки (временные или бессрочные).',
      controls: ['Автоматическое снятие defanging ([.] -> .)', 'Извлечение IP/DNS/Hash по регулярным выражениям', 'Защита от спуфинга и повторной обработки по Message-ID']
    },
    {
      id: 'node-hr-pdf',
      title: 'HR Департамент (Приказы JML)',
      subtitle: 'PDF-приказы: Прием / Перевод / Увольнение',
      category: 'source',
      icon: 'file',
      color: '#f59e0b',
      ipOrHost: 'IMAP PDF Stream',
      owner: 'Департамент HR -> Группа контроля доступов ИБ',
      x: 60,
      y: 260,
      description: 'Автоматическое получение кадровых PDF-приказов (Joiner / Mover / Leaver). Парсер извлекает ФИО сотрудника, тип приказа, старую и новую должность, подразделение и дату вступления в силу.',
      controls: ['Автоматический разбор текста PDF', 'Формирование записи в реестре HR Приказов (JML)', 'Контроль отключения/выдачи доступов по 5 системам ИБ']
    },
    {
      id: 'node-derscanner',
      title: 'DerScanner (SAST / DAST)',
      subtitle: 'Статический и динамический анализ кода',
      category: 'scanner',
      icon: 'bug',
      color: '#ec4899',
      ipOrHost: 'REST API / Jira Webhook Gateway',
      owner: 'Группа AppSec / Безопасной разработки',
      x: 60,
      y: 450,
      description: 'Анализатор защищенности исходного кода и приложений. Передает найденные уязвимости (Critical/High/Medium, CWE, файл и строку кода) напрямую в Pulse12 через встроенный шлюз совместимости Jira REST API v2.',
      controls: ['Авторизация по токену интеграции (ds-live-...)', 'Триаж уязвимостей в Центре Безопасности (False Positive / Подтверждено)', 'Перевод уязвимости в задачу разработчикам в 1 клик (Promote to Task)']
    },
    {
      id: 'node-ad',
      title: 'Active Directory (LDAP / LDAPS)',
      subtitle: 'Единый каталог сотрудников и групп',
      category: 'identity',
      icon: 'users',
      color: '#a855f7',
      ipOrHost: 'LDAP 389 / LDAPS 636',
      owner: 'Служба каталогов / Администраторы ИБ',
      x: 60,
      y: 640,
      description: 'Корпоративный контроллер домена Active Directory. Обеспечивает доменную аутентификацию сотрудников в Pulse12, синхронизацию штатной структуры, должностей и автоматическое распределение по Рабочим Пространствам (Workspaces).',
      controls: ['Защита от LDAP-инъекций (RFC 4515 escaping)', 'Авто-привязка департаментов к изолированным пространствам', 'Блокировка входа при отключении учетной записи в AD']
    },
    {
      id: 'node-pulse-core',
      title: 'Ядро Pulse12 Corporate (SOAR & Agile)',
      subtitle: 'Центральная платформа оркестрации ДКБ',
      category: 'core',
      icon: 'shield',
      color: '#6366f1',
      ipOrHost: '172.31.71.55 (Docker + Nginx TLS)',
      owner: 'Департамент Кибербезопасности (ДКБ)',
      x: 500,
      y: 330,
      description: 'Центральный узел управления процессами ДКБ: объединяет SOAR-автоматизацию блокировок, Центр триажа уязвимостей, реестр кадровых приказов JML, изолированные рабочие пространства департаментов (Канбан, Спринты, Архивы) и живой мониторинг.',
      controls: ['Ролевой доступ (RBAC) и межпространственная изоляция (Workspaces)', 'Хеширование учетных данных bcrypt + защита от Brute-Force', 'Живой журнал событий (Live System Logs) и авто-снапшоты БД']
    },
    {
      id: 'node-postgres',
      title: 'PostgreSQL 16 + Архив Снапшотов',
      subtitle: 'Надежное хранилище и резервные копии',
      category: 'storage',
      icon: 'database',
      color: '#10b981',
      ipOrHost: 'Internal Docker Network (10.12.0.0/16)',
      owner: 'Администраторы платформы Pulse12',
      x: 500,
      y: 620,
      description: 'Изолированная СУБД PostgreSQL 16 с автоматическим резервным копированием (Auto-Backup каждые 24 часа + архивы спринтов и реестра JML) и автоматическим маскированием секретов в снапшотах.',
      controls: ['Ежедневные JSON-снапшоты с редактированием паролей/токенов', 'Отдельные неизменяемые бэкапы при завершении спринтов и JML', 'Транзакционная запись с защитой от потери коллекций']
    },
    {
      id: 'node-fortigate',
      title: 'FortiGate NGFW (SOAR Auto-Ban)',
      subtitle: 'Межсетевой экран периметра',
      category: 'enforcement',
      icon: 'flame',
      color: '#ef4444',
      ipOrHost: '172.31.69.30:10443 (Automation Stitch)',
      owner: 'Отдел сетевой безопасности',
      x: 950,
      y: 80,
      description: 'Автоматическое исполнение блокировок вредоносных IP-адресов через защищенный Webhook Automation Stitch. Включает интеллектуальный балансировщик групп (Allocator) по 600 адресов на группу и Cron-службу автоматического разбана по истечении срока (90 дней).',
      controls: ['Балансировка по группам Malicious IP.s KZ-CERT Pulse_1..3 и Pulse_Perm', 'Автоматический разбан просроченных временных IP каждый час', 'Ручное управление блокировками и проверка связности из UI']
    },
    {
      id: 'node-kata',
      title: 'Kaspersky KATA / KES',
      subtitle: 'Защита от целевых атак и конечных точек',
      category: 'enforcement',
      icon: 'cpu',
      color: '#14b8a6',
      ipOrHost: 'OpenIOC XML & Threat Feed API',
      owner: 'Отдел защиты инфраструктуры и EDR',
      x: 950,
      y: 280,
      description: 'Автоматическая генерация файлов индикаторов компрометации в стандарте Mandiant OpenIOC XML (KATA_Indicators.ioc) и публикация динамического фида хэшей (/api/feeds/kata-hashes.txt) для импорта в Kaspersky Anti Targeted Attack.',
      controls: ['Дедупликация хэшей MD5 / SHA-1 / SHA-256', 'Автоматическая сборка валидного XML OpenIOC контейнера', 'Контроль установки агента KES при кадровых изменениях JML']
    },
    {
      id: 'node-jml-contour',
      title: 'Контур систем контроля JML',
      subtitle: 'AD • Kaspersky • DLP • Staffcop • Cisco Duo',
      category: 'enforcement',
      icon: 'lock',
      color: '#eab308',
      ipOrHost: 'Корпоративный контур ИБ',
      owner: 'Инженеры контроля доступов и DLP',
      x: 950,
      y: 480,
      description: 'Комплекс систем безопасности, обязательных к проверке при приеме, переводе, декрете или увольнении сотрудника: учетная запись AD, антивирусная защита Kaspersky, агент предотвращения утечек DLP, мониторинг Staffcop и двухфакторная аутентификация Cisco Duo.',
      controls: ['Пошаговая фиксация статуса по каждой из 5 систем в реестре JML', 'Архивация и резервное копирование отработанных приказов', 'Выгрузка аудиторских отчетов в CSV / Excel']
    },
    {
      id: 'node-audit-reports',
      title: 'Отчетность, Метрики SLA и Аудит',
      subtitle: 'PDF / Excel выгрузки для проверок',
      category: 'reporting',
      icon: 'chart',
      color: '#3b82f6',
      ipOrHost: 'HTTPS PDF/CSV Generator',
      owner: 'Руководство ДКБ и Аудиторы',
      x: 950,
      y: 660,
      description: 'Формирование официальных корпоративных PDF-отчетов с поддержкой кириллицы по спринтам, сотрудникам, заблокированным индикаторам и закрытым уязвимостям.',
      controls: ['Генерация PDF-отчетов по подразделениям и спринтам', 'Экспорт задач и реестра JML в Excel / CSV', 'Хранение архивных слепков завершенных итераций']
    }
  ],
  edges: [
    { id: 'e-1', from: 'node-kzcert', to: 'node-pulse-core', label: 'IMAP TLS: IP, DNS, Хэши' },
    { id: 'e-2', from: 'node-hr-pdf', to: 'node-pulse-core', label: 'IMAP: PDF Приказы JML' },
    { id: 'e-3', from: 'node-derscanner', to: 'node-pulse-core', label: 'REST Webhook: SAST Уязвимости' },
    { id: 'e-4', from: 'node-ad', to: 'node-pulse-core', label: 'LDAP: Пользователи и Отделы' },
    { id: 'e-5', from: 'node-pulse-core', to: 'node-postgres', label: 'JSONB + Авто-снапшоты 24ч' },
    { id: 'e-6', from: 'node-pulse-core', to: 'node-fortigate', label: 'HTTPS Webhook: Auto-Ban / Unban IP' },
    { id: 'e-7', from: 'node-pulse-core', to: 'node-kata', label: 'OpenIOC XML & Hash Feed' },
    { id: 'e-8', from: 'node-pulse-core', to: 'node-jml-contour', label: 'Контроль 5 систем по приказам' },
    { id: 'e-9', from: 'node-pulse-core', to: 'node-audit-reports', label: 'PDF / CSV Отчеты и Метрики' }
  ]
};

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

  // --- ARCHITECTURE DIAGRAM ENDPOINTS ---
  router.get('/architecture', requireAuth, async (req, res) => {
    if (!req.dbData.dkbArchitecture || !Array.isArray(req.dbData.dkbArchitecture.nodes)) {
      req.dbData.dkbArchitecture = JSON.parse(JSON.stringify(DEFAULT_DKB_ARCHITECTURE));
      await saveCollection('dkbArchitecture', req.dbData.dkbArchitecture);
    }
    const stats = {
      bannedIpsCount: Array.isArray(req.dbData.bannedIps) ? req.dbData.bannedIps.length : 0,
      kataHashesCount: Array.isArray(req.dbData.kataHashes) ? req.dbData.kataHashes.length : 0,
      findingsCount: Array.isArray(req.dbData.findings) ? req.dbData.findings.length : 0,
      hrOrdersCount: Array.isArray(req.dbData.hr_orders) ? req.dbData.hr_orders.length : 0,
      usersCount: Array.isArray(req.dbData.users) ? req.dbData.users.length : 0,
      workspacesCount: Array.isArray(req.dbData.workspaces) ? req.dbData.workspaces.length : 0,
      tasksCount: Array.isArray(req.dbData.tasks) ? req.dbData.tasks.length : 0
    };
    res.json({ architecture: req.dbData.dkbArchitecture, stats });
  });

  router.post('/architecture', requireAuth, async (req, res) => {
    if (req.currentUser?.roleType !== 'admin' && req.currentUser?.roleType !== 'manager') {
      return res.status(403).json({ error: 'Редактировать схему архитектуры могут только администраторы и руководители' });
    }
    const { architecture, resetToDefault } = req.body || {};
    if (resetToDefault) {
      req.dbData.dkbArchitecture = JSON.parse(JSON.stringify(DEFAULT_DKB_ARCHITECTURE));
    } else if (architecture && Array.isArray(architecture.nodes)) {
      req.dbData.dkbArchitecture = {
        ...architecture,
        updatedAt: new Date().toISOString()
      };
    } else {
      return res.status(400).json({ error: 'Некорректные данные схемы' });
    }
    await saveCollection('dkbArchitecture', req.dbData.dkbArchitecture);
    res.json({ success: true, architecture: req.dbData.dkbArchitecture });
  });

  // --- BACKUPS & ARCHIVES ENDPOINTS ---
  router.get('/backups', requireAuth, async (req, res) => {
    const snapshots = await listSnapshots();
    res.json({ snapshots });
  });

  router.post('/backups/create', requireAuth, async (req, res) => {
    const { type } = req.body || {};
    if (type === 'hr_jml') {
      const filename = await createSnapshot({
        backupType: 'hr_jml',
        createdAt: new Date().toISOString(),
        hr_orders: req.dbData.hr_orders || []
      }, 'hr_jml_backup');
      return res.json({ success: true, filename });
    }
    if (type === 'sprint' && req.body.sprintId) {
      const sp = (req.dbData.sprints || []).find(s => s.id === req.body.sprintId);
      const spTasks = (req.dbData.tasks || []).filter(t => t.sprintId === req.body.sprintId);
      const filename = await createSnapshot({
        backupType: 'sprint',
        createdAt: new Date().toISOString(),
        sprint: sp || null,
        tasks: spTasks
      }, `sprint_${req.body.sprintId}`);
      return res.json({ success: true, filename });
    }
    const filename = await createSnapshot(req.dbData, 'snapshot_manual');
    res.json({ success: true, filename });
  });

  router.get('/backups/download/:filename', requireAuth, async (req, res) => {
    try {
      const data = await readSnapshotFile(req.params.filename);
      res.json({ success: true, data });
    } catch (e) {
      res.status(404).json({ error: 'Файл бэкапа не найден' });
    }
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
