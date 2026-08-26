import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import sanitizeHtml from 'sanitize-html';
import { saveCollection } from '../db.js';
import { banIpAddress } from './fortigateService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

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
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi;
const DATE_REGEX = /\b(\d{2})\.(\d{2})\.(\d{4})\b/g;

// Регулярные выражения для хэшей KATA
const MD5_REGEX = /\b[a-fA-F0-9]{32}\b/g;
const SHA1_REGEX = /\b[a-fA-F0-9]{40}\b/g;
const SHA256_REGEX = /\b[a-fA-F0-9]{64}\b/g;


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
    const parsedMail = await simpleParser(message.source);

    const messageId = parsedMail.messageId;
    if (messageId) {
      if (!currentDbData.processedEmails) currentDbData.processedEmails = [];
      if (currentDbData.processedEmails.includes(messageId)) {
        console.log(`[IMAP] Письмо ${messageId} уже обработано. Пропуск.`);
        return;
      }
    }
    
    const senderEmail = findSender(parsedMail);
    if (!senderEmail) {
      return;
    }
    
    const pulseUser = currentDbData.users?.find(u => 
      u.email && u.email.toLowerCase() === senderEmail
    ) || currentDbData.users?.find(u => 
      u.login && u.login.toLowerCase() === senderEmail
    );

    if (!pulseUser) {
      console.log(`[IMAP] Пропуск письма от ${senderEmail}: пользователь не найден в базе Pulse 12 (защита от спама).`);
      return;
    }

    let rawHtml = String(parsedMail.html || '') + ' ' + String(parsedMail.textAsHtml || '');
    
    // Defanging: убираем скобки вокруг точек и hXXp, которые часто используют CERT
    rawHtml = rawHtml.replace(/\[\.\]/g, '.').replace(/hxxp/gi, 'http');

    const cleanHtmlText = sanitizeHtml(rawHtml, { allowedTags: [], allowedAttributes: {} });
    const bodyText = String(parsedMail.text || '').replace(/\[\.\]/g, '.').replace(/hxxp/gi, 'http') + ' ' + cleanHtmlText;

    const foundIps = bodyText.match(IP_REGEX) || [];
    const foundDomains = bodyText.match(DNS_DOMAIN_REGEX) || [];
    const foundDnsQueries = bodyText.match(DNS_QUERY_REGEX) || [];
    const foundEmails = bodyText.match(EMAIL_REGEX) || [];
    
    const foundMd5 = bodyText.match(MD5_REGEX) || [];
    const foundSha1 = bodyText.match(SHA1_REGEX) || [];
    const foundSha256 = bodyText.match(SHA256_REGEX) || [];
    
    const senderDomain = senderEmail.split('@')[1];
    let allIndicators = [...new Set([...foundIps, ...foundDomains, ...foundDnsQueries, ...foundEmails, ...foundMd5, ...foundSha1, ...foundSha256])];
    
    if (senderDomain) {
       allIndicators = allIndicators.filter(ind => !ind.toLowerCase().includes(senderDomain));
    }

    if (allIndicators.length === 0) {
      console.log(`[IMAP] Пропуск письма от ${senderEmail}: не найдено валидных индикаторов компрометации (IP/DNS/Hashes).`);
      return;
    }

    const cleanBody = sanitizeHtml(parsedMail.html || parsedMail.textAsHtml || `<p>${bodyText}</p>`, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat([ 'img' ])
    });

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

    const uniqueIps = [...new Set(foundIps)].filter(ind => !senderDomain || !ind.toLowerCase().includes(senderDomain));

    if (uniqueIps.length > 0) {
      createAttachment('IP_Addresses.txt', uniqueIps.join('\n'));
    }
    
    const otherDns = [...new Set([...foundDomains, ...foundDnsQueries])].filter(ind => !senderDomain || !ind.toLowerCase().includes(senderDomain));
    if (otherDns.length > 0) {
      createAttachment('DNS_Records.txt', otherDns.join('\n'));
    }

    const uniqueEmails = [...new Set(foundEmails)].filter(ind => !senderDomain || !ind.toLowerCase().includes(senderDomain) && ind.toLowerCase() !== senderEmail);
    if (uniqueEmails.length > 0) {
      createAttachment('Email_Addresses.txt', uniqueEmails.join('\n'));
    }

    // --- Обработка и сохранение хэшей для KATA ---
    const uniqueMd5 = [...new Set(foundMd5)];
    const uniqueSha1 = [...new Set(foundSha1)];
    const uniqueSha256 = [...new Set(foundSha256)];
    
    if (!currentDbData.kataHashes) currentDbData.kataHashes = [];
    let addedHashesCount = 0;
    
    const addHashes = (hashes, type) => {
      for (const h of hashes) {
        const lowerHash = h.toLowerCase();
        if (!currentDbData.kataHashes.find(item => item.hash === lowerHash)) {
          currentDbData.kataHashes.push({
            hash: lowerHash,
            type: type,
            addedAt: Date.now(),
            source: 'KZ-CERT'
          });
          addedHashesCount++;
        }
      }
    };
    
    addHashes(uniqueMd5, 'MD5');
    addHashes(uniqueSha1, 'SHA-1');
    addHashes(uniqueSha256, 'SHA-256');

    if (addedHashesCount > 0) {
      await saveCollection('kataHashes', currentDbData.kataHashes);
    }

    const allUniqueHashes = [...uniqueMd5, ...uniqueSha1, ...uniqueSha256];
    if (allUniqueHashes.length > 0) {
      // 1. Создаем TXT-файл на всякий случай
      createAttachment('KATA_Hashes.txt', allUniqueHashes.join('\n'));
      
      // 2. Генерируем OpenIOC XML формат для кнопки "Импортировать" в KATA
      const nowIso = new Date().toISOString().split('.')[0] + 'Z';
      const rootId = crypto.randomUUID();
      const indicatorId = crypto.randomUUID();
      
      let indicatorItemsXml = '';
      
      uniqueMd5.forEach(hash => {
        indicatorItemsXml += `
      <IndicatorItem id="${crypto.randomUUID()}" condition="is">
        <Context document="FileItem" search="FileItem/Md5sum" type="mir"/>
        <Content type="md5">${hash}</Content>
      </IndicatorItem>`;
      });
      
      uniqueSha1.forEach(hash => {
        indicatorItemsXml += `
      <IndicatorItem id="${crypto.randomUUID()}" condition="is">
        <Context document="FileItem" search="FileItem/Sha1sum" type="mir"/>
        <Content type="sha1">${hash}</Content>
      </IndicatorItem>`;
      });
      
      uniqueSha256.forEach(hash => {
        indicatorItemsXml += `
      <IndicatorItem id="${crypto.randomUUID()}" condition="is">
        <Context document="FileItem" search="FileItem/Sha256sum" type="mir"/>
        <Content type="sha256">${hash}</Content>
      </IndicatorItem>`;
      });

      const openIocXml = `<?xml version="1.0" encoding="UTF-8"?>
<ioc xmlns="http://schemas.mandiant.com/2010/ioc" id="${rootId}" last-modified="${nowIso}">
  <short_description>Pulse12 Auto-Generated IoC for KATA</short_description>
  <description>Auto-extracted hashes from KZ-CERT bulletin or alert</description>
  <authored_by>Pulse12 SOAR</authored_by>
  <authored_date>${nowIso}</authored_date>
  <definition>
    <Indicator operator="OR" id="${indicatorId}">
${indicatorItemsXml}
    </Indicator>
  </definition>
</ioc>`;

      createAttachment('KATA_Indicators.ioc', openIocXml);
    }


    // Проверяем срок действия (например, 'бессрочно' в бюллетенях KZ-CERT)
    const isPermanent = /бессрочно/i.test(bodyText);
    
    // Ищем конкретные даты до какого числа (DD.MM.YYYY)
    let parsedExpirationDate = null;
    const foundDates = bodyText.match(DATE_REGEX) || [];
    if (foundDates.length > 0) {
      // Берем самую позднюю дату из найденных в письме
      const timestamps = foundDates.map(d => {
        const [day, month, year] = d.split('.');
        return new Date(`${year}-${month}-${day}T00:00:00Z`).getTime();
      }).filter(t => !isNaN(t));
      if (timestamps.length > 0) {
        const maxTime = Math.max(...timestamps);
        if (maxTime > Date.now()) {
          parsedExpirationDate = maxTime;
        }
      }
    }

    let fortigateBanStatus = '';

    // --- Интеграция с FortiGate (Auto-Ban) ---
    if (uniqueIps.length > 0 && currentDbData.fortigateSettings?.enabled && currentDbData.fortigateSettings?.autoBanEnabled) {
      let bannedCount = 0;
      const oldBannedLength = currentDbData.bannedIps ? currentDbData.bannedIps.length : 0;
      
      for (const ip of uniqueIps) {
        const success = await banIpAddress(currentDbData.fortigateSettings, ip);
        if (success) {
          bannedCount++;
          // Сохраняем в bannedIps с таймером 3 месяца или бессрочно или до конкретной даты
          const banDuration = currentDbData.fortigateSettings.banDurationDays || 90;
          let expiresAt = Date.now() + (banDuration * 24 * 60 * 60 * 1000);
          
          if (isPermanent) {
            expiresAt = Date.now() + 100 * 365 * 24 * 60 * 60 * 1000;
          } else if (parsedExpirationDate) {
            expiresAt = parsedExpirationDate;
          }
          
          if (!currentDbData.bannedIps) currentDbData.bannedIps = [];
          currentDbData.bannedIps = currentDbData.bannedIps.filter(b => b.ip !== ip);
          currentDbData.bannedIps.push({ ip, bannedAt: Date.now(), expiresAt, isPermanent });
        }
      }
      
      
      if (bannedCount > 0) {
        fortigateBanStatus = `<br/><br/><strong>[SOAR Auto-Ban]</strong> ${bannedCount} IP-адресов автоматически заблокированы на FortiGate!`;
        await saveCollection('bannedIps', currentDbData.bannedIps);
        
        // Проверка лимитов группы FortiGate (например, 500 адресов)
        const newBannedLength = currentDbData.bannedIps.length;
        const threshold = 500;
        if (Math.floor(oldBannedLength / threshold) < Math.floor(newBannedLength / threshold)) {
          // Создаем отдельную задачу-алерт для админов
          const alertTask = {
            id: `task-${Date.now()}-alert`,
            title: `⚠️ ВНИМАНИЕ: Группа FortiGate достигла лимита (${newBannedLength} адресов)`,
            description: `Группа адресов на FortiGate (${currentDbData.fortigateSettings.addressGroup || 'Pulse_Banned_IPs'}) превысила порог в ${newBannedLength} записей.\n\nВозможно, достигнут хард-лимит FortiOS на количество объектов в одной группе. Рекомендуется создать вторую группу и изменить название целевой группы в настройках интеграции Pulse 12.`,
            status: 'todo',
            priority: 'high',
            department: 'Кибербезопасность',
            assigneeId: pulseUser.id,
            authorId: 'system',
            createdAt: new Date().toISOString()
          };
          if (!currentDbData.tasks) currentDbData.tasks = [];
          currentDbData.tasks.push(alertTask);
          await saveCollection('tasks', currentDbData.tasks);
          if (currentBroadcast) {
            currentBroadcast('newTask', alertTask);
          }
        }
      }
    }

    const newTask = {
      id: `task-${Date.now()}`,
      title: cleanSubject(parsedMail.subject),
      description: `${cleanBody}<br/><br/><strong>Найденные индикаторы (IP/DNS) сохранены в прикрепленных файлах.</strong>${fortigateBanStatus}`,
      status: 'to-do',
      priority: 'high',
      assigneeId: pulseUser.id,
      creatorId: pulseUser.id,
      createdAt: new Date().toISOString(),
      sprintId: 'unassigned',
      attachments: attachments
    };

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
      if (client.usable) {
        await client.logout();
      } else {
        client.close();
      }
    } catch (err) {
      // Игнорируем ошибки при принудительном закрытии
    }
    client = null;
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
      startImapService(settings, currentDbData, currentBroadcast);
    }, 15000);
  });

  try {
    await client.connect();
    console.log(`✅ [IMAP] Успешно подключено к ящику ${settings.user}`);

    let lock = await client.getMailboxLock('INBOX');
    
    // Функция для проверки непрочитанных писем
    let isProcessing = false;
    const checkUnread = async () => {
      if (isProcessing) return;
      isProcessing = true;
      try {
        const searchOptions = { seen: false };
        for await (let msg of client.fetch(searchOptions, { source: true, uid: true, headers: ['message-id'] })) {
          await processEmail(msg, msg.uid);
          await client.messageFlagsAdd(msg.uid, ['\\Seen'], { uid: true });
        }
      } catch (e) {
        console.error('⚠️ [IMAP] Ошибка в процессе чтения:', e.message);
      } finally {
        isProcessing = false;
      }
    };

    try {
      // 1. Проверяем сразу при запуске
      await checkUnread();

      // 2. Включаем подписку на новые письма (IMAP IDLE)
      client.on('exists', async (data) => {
        console.log(`[IMAP] Поступили новые письма (Всего в ящике: ${data.count})`);
        await checkUnread();
      });

      // 3. Запускаем резервный таймер (каждые 60 секунд), так как корпоративный Exchange часто рвет IMAP IDLE
      const fetchInterval = setInterval(async () => {
        if (client && client.usable) {
          await checkUnread();
        } else {
          clearInterval(fetchInterval);
        }
      }, 60000);

      client.on('close', () => {
        clearInterval(fetchInterval);
      });
      
    } catch (err) {
      console.error('❌ [IMAP] Ошибка при чтении ящика:', err.message);
      lock.release();
    }
  } catch (err) {
    console.error('❌ [IMAP] Ошибка подключения:', err.message);
  }
};
