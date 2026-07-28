import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import sanitizeHtml from 'sanitize-html';
import { saveCollection } from '../db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, '..', 'data', 'uploads');

let client = null;
let currentDbData = null;
let currentBroadcast = null;

// Регулярные выражения для парсинга
const IP_REGEX = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;
const DNS_DOMAIN_REGEX = /\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+(?:com|net|org|kz|ru|info|biz|gov)\b/gi;
const DNS_QUERY_REGEX = /\b(?:NS|A|AAAA|MX|CNAME|TXT)\s+record\b/gi;

/**
 * Очистка префиксов пересылки из темы письма
 */
const cleanSubject = (subject) => {
  if (!subject) return 'Новая задача из почты';
  return subject.replace(/^(?:FW:|Fwd:|Пересл:|TR:)\s*/i, '').trim();
};

/**
 * Поиск оригинального отправителя (кто нажал "Переслать")
 */
const findSender = (mail) => {
  // mail.from.value - это массив объектов { address, name }
  if (mail.from && mail.from.value && mail.from.value.length > 0) {
    return mail.from.value[0].address.toLowerCase();
  }
  return null;
};

/**
 * Обработка одного письма
 */
const processEmail = async (message, uid) => {
  try {
    // 1. Парсинг содержимого (RFC822)
    const parsedMail = await simpleParser(message.source);

    // 2. Защита от дубликатов (проверка Message-ID)
    const messageId = parsedMail.messageId;
    if (messageId) {
      if (!currentDbData.processedEmails) currentDbData.processedEmails = [];
      if (currentDbData.processedEmails.includes(messageId)) {
        console.log(`[IMAP] Письмо ${messageId} уже обработано. Пропуск.`);
        return;
      }
    }
    
    // 3. Поиск пользователя в БД Pulse 12 по email отправителя
    const senderEmail = findSender(parsedMail);
    if (!senderEmail) {
      console.log(`[IMAP] Отправитель не найден. Пропуск.`);
      return;
    }
    
    const pulseUser = currentDbData.users?.find(u => 
      u.email && u.email.toLowerCase() === senderEmail
    ) || currentDbData.users?.find(u => 
      u.login && u.login.toLowerCase() === senderEmail
    );

    if (!pulseUser) {
      console.log(`[IMAP] Отправитель ${senderEmail} не найден в базе Pulse 12. Пропуск.`);
      return;
    }

    // 4. Фильтрация контента (Поиск IP-адресов и DNS)
    const bodyText = String(parsedMail.text || '') + ' ' + String(parsedMail.html || '') + ' ' + String(parsedMail.textAsHtml || '');
    const foundIps = bodyText.match(IP_REGEX) || [];
    const foundDomains = bodyText.match(DNS_DOMAIN_REGEX) || [];
    const foundDnsQueries = bodyText.match(DNS_QUERY_REGEX) || [];
    
    const allIndicators = [...new Set([...foundIps, ...foundDomains, ...foundDnsQueries])];

    if (allIndicators.length === 0) {
      console.log(`[IMAP] В письме от ${senderEmail} не найдено IP-адресов или DNS-запросов. Игнорируем (не задача). Текст: ${bodyText.substring(0, 50)}...`);
      return;
    }

    // 5. Очистка текста
    const cleanBody = sanitizeHtml(parsedMail.html || parsedMail.textAsHtml || `<p>${bodyText}</p>`, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat([ 'img' ])
    });

    // 6. Формирование вложений (TXT файлы для IP и DNS)
    const attachments = [];
    const createAttachment = (filename, content) => {
      const safeName = `${Date.now()}_${filename}`;
      const filePath = path.join(UPLOADS_DIR, safeName);
      if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      }
      fs.writeFileSync(filePath, content, 'utf-8');
      const stats = fs.statSync(filePath);
      attachments.push({
        id: `att-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        filename: filename,
        url: `/uploads/${safeName}`,
        size: stats.size,
        uploadedAt: new Date().toISOString()
      });
    };

    if (foundIps.length > 0) {
      createAttachment('IP_Addresses.txt', [...new Set(foundIps)].join('\n'));
    }
    
    const otherDns = [...new Set([...foundDomains, ...foundDnsQueries])];
    if (otherDns.length > 0) {
      createAttachment('DNS_Records.txt', otherDns.join('\n'));
    }

    // 7. Создание задачи
    const newTask = {
      id: `task-${Date.now()}`,
      title: cleanSubject(parsedMail.subject),
      description: `${cleanBody}<br/><br/><strong>Найденные индикаторы (IP/DNS) сохранены в прикрепленных файлах.</strong>`,
      status: 'to-do',
      priority: 'high', // Письма с алертами обычно важные
      assigneeId: pulseUser.id, // Назначаем на того, кто переслал
      creatorId: pulseUser.id,
      createdAt: new Date().toISOString(),
      sprintId: 'unassigned', // В Jira-clone используется 'unassigned' для Бэклога
      attachments: attachments
    };

    // 7. Сохранение и рассылка уведомлений
    if (!currentDbData.tasks) currentDbData.tasks = [];
    currentDbData.tasks.push(newTask);
    await saveCollection('tasks', currentDbData.tasks);

    // Запоминаем, что обработали это письмо
    if (messageId) {
      if (!currentDbData.processedEmails) currentDbData.processedEmails = [];
      currentDbData.processedEmails.push(messageId);
      // Ограничиваем историю 1000 последними письмами, чтобы база не пухла
      if (currentDbData.processedEmails.length > 1000) {
        currentDbData.processedEmails.shift();
      }
      await saveCollection('processedEmails', currentDbData.processedEmails);
    }

    if (currentBroadcast) {
      currentBroadcast('tasks');
    }

    console.log(`✅ [IMAP] Создана новая задача "${newTask.title}" для ${pulseUser.name}`);

  } catch (err) {
    console.error('❌ [IMAP] Ошибка при обработке письма:', err);
  }
};

/**
 * Остановка сервиса
 */
export const stopImapService = async () => {
  if (client) {
    try {
      console.log('[IMAP] Остановка сервиса...');
      await client.logout();
      client = null;
    } catch (err) {
      console.error('[IMAP] Ошибка при отключении:', err);
    }
  }
};

/**
 * Запуск сервиса
 */
export const startImapService = async (settings, dbData, broadcastUpdate) => {
  // Останавливаем старый клиент, если он был
  await stopImapService();

  if (!settings || !settings.enabled || !settings.host || !settings.user || !settings.password) {
    console.log('[IMAP] Интеграция с почтой выключена или не настроена полностью.');
    return;
  }

  currentDbData = dbData;
  currentBroadcast = broadcastUpdate;

  client = new ImapFlow({
    host: settings.host,
    port: parseInt(settings.port, 10) || 993,
    secure: settings.tls !== false,
    tls: {
      rejectUnauthorized: false
    },
    auth: {
      user: settings.user,
      pass: settings.password
    },
    logger: false // отключить спам в консоль
  });

  // Предотвращаем падение всего сервера Node.js при обрыве сокета (Socket timeout)
  client.on('error', err => {
    console.error('❌ [IMAP] Ошибка соединения (возможно таймаут):', err.message);
  });

  client.on('close', () => {
    console.log('⚠️ [IMAP] Соединение закрыто. Попытка переподключения через 15 секунд...');
    setTimeout(() => {
      initImapService(settings, currentDbData, currentBroadcast);
    }, 15000);
  });

  try {
    await client.connect();
    console.log(`✅ [IMAP] Успешно подключено к ящику ${settings.user}`);

    // Подключаемся к папке Входящие
    let lock = await client.getMailboxLock('INBOX');
    try {
      // 1. Проверяем новые (непрочитанные) письма, которые могли прийти пока сервер был выключен
      const searchOptions = { seen: false };
      for await (let msg of client.fetch(searchOptions, { source: true, uid: true, headers: ['message-id'] })) {
        await processEmail(msg, msg.uid);
        // Отмечаем как прочитанное, чтобы не читать снова при рестарте
        await client.messageFlagsAdd(msg.uid, ['\\Seen'], { uid: true });
      }

      // 2. Включаем подписку на новые письма (IMAP IDLE)
      client.on('exists', async (data) => {
        console.log(`[IMAP] Поступили новые письма (Всего в ящике: ${data.count})`);
        // Берем самое последнее письмо
        for await (let msg of client.fetch(data.count, { source: true, uid: true, headers: ['message-id'] })) {
           await processEmail(msg, msg.uid);
           await client.messageFlagsAdd(msg.uid, ['\\Seen'], { uid: true });
        }
      });
      
    } catch (err) {
      console.error('❌ [IMAP] Ошибка при чтении ящика:', err.message);
      lock.release();
    }
  } catch (err) {
    console.error('❌ [IMAP] Ошибка подключения:', err.message);
  }
};
