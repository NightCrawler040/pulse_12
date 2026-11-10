import axios from 'axios';
import https from 'https';

// Настройка HTTPS агента для обхода самоподписанных сертификатов (часто бывает на FortiGate)
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

/**
 * Отправка вебхука на FortiGate
 * @param {string} url - Webhook URL
 * @param {string} token - API Token
 * @param {string} ip - IP-адрес для блокировки/разблокировки
 */
const triggerFortigateWebhook = async (url, token, ip, addressGroup) => {
  if (!url || !token) {
    throw new Error('FortiGate URL или Token не настроены');
  }

  try {
    const payload = {
      srcip: ip,
      fortigate_addresses: ip,
      address_group: addressGroup || 'Pulse_Banned_IPs'
    };

    const response = await axios.post(url, payload, {
      timeout: 10000,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      httpsAgent
    });

    console.log(`✅ [FortiGate] Успешный запрос к вебхуку для IP ${ip} (группа: ${payload.address_group}). Статус: ${response.status}`);
    return true;
  } catch (error) {
    console.error(`❌ [FortiGate] Ошибка запроса для IP ${ip}:`, error.message);
    if (error.response) {
      console.error('Ответ FortiGate:', error.response.data);
    }
    return false;
  }
};

/**
 * Блокировка IP-адреса
 */
export const banIpAddress = async (settings, ip, fortigateGroup = null) => {
  if (!settings.enabled || !settings.banUrl) {
    console.log(`⚠️ [FortiGate] Блокировка пропущена. Интеграция выключена или URL не задан.`);
    return false;
  }
  
  const targetGroup = fortigateGroup || settings.addressGroup || 'Pulse_Banned_IPs';
  console.log(`🔒 [FortiGate] Отправка команды на БЛОКИРОВКУ IP: ${ip} (в группу: ${targetGroup})`);
  return await triggerFortigateWebhook(settings.banUrl, settings.apiToken, ip, targetGroup);
};

/**
 * Снятие блокировки с IP-адреса
 */
export const unbanIpAddress = async (settings, ip, fortigateGroup = null) => {
  if (!settings.enabled || !settings.unbanUrl) {
    console.log(`⚠️ [FortiGate] Снятие блокировки пропущено. Интеграция выключена или URL не задан.`);
    return false;
  }

  const targetGroup = fortigateGroup || settings.addressGroup || 'Pulse_Banned_IPs';
  console.log(`🔓 [FortiGate] Отправка команды на РАЗБЛОКИРОВКУ IP: ${ip} (из группы: ${targetGroup})`);
  return await triggerFortigateWebhook(settings.unbanUrl, settings.apiToken, ip, targetGroup);
};


/**
 * Allocates a FortiGate group for an IP based on current database capacity
 */
export const allocateFortigateGroup = (bannedIps, isPermanent, settings) => {
  const permGroup = settings.permGroup || 'Pulse_Perm';
  if (isPermanent) {
    return permGroup;
  }

  const tempGroups = (Array.isArray(settings.tempGroups) && settings.tempGroups.length > 0)
    ? settings.tempGroups
    : ['Malicious IP.s KZ-CERT Pulse_1', 'Malicious IP.s KZ-CERT Pulse_2', 'Malicious IP.s KZ-CERT Pulse_3'];
  const maxPerGroup = settings.maxPerGroup || 600;

  const groupCounts = {};
  tempGroups.forEach(g => groupCounts[g] = 0);

  (bannedIps || []).forEach(b => {
    if (b.fortigateGroup && groupCounts[b.fortigateGroup] !== undefined) {
      groupCounts[b.fortigateGroup]++;
    }
  });

  for (const group of tempGroups) {
    if (groupCounts[group] < maxPerGroup) {
      return group;
    }
  }

  return tempGroups[tempGroups.length - 1];
};


/**
 * Запуск cron-задачи для автоматического разбана IP-адресов по истечении срока (обычно 90 дней)
 */
export const startFortigateCron = (getDbDataFn, saveCollectionFn) => {
  console.log('🛡️ [FortiGate] Запуск cron-сервиса автоматического разбана (проверка каждый час)');
  
  const processExpiredBans = async () => {
    try {
      const dbData = getDbDataFn();
      if (!dbData || !Array.isArray(dbData.bannedIps) || dbData.bannedIps.length === 0) return;

      const now = Date.now();
      let hasChanges = false;
      
      for (const record of dbData.bannedIps) {
        if (record.isPermanent) continue; // Игнорируем перманентные баны

        if (record.expiresAt && now > record.expiresAt) {
          console.log(`⏳ [FortiGate Cron] Время бана для IP ${record.ip} истекло. Выполняем разбан (группа: ${record.fortigateGroup || 'default'})...`);
          
          const settings = dbData.fortigateSettings?.['WS-1'] || dbData.fortigateSettings;
          
          if (settings && settings.enabled && settings.unbanUrl) {
            const success = await unbanIpAddress(settings, record.ip, record.fortigateGroup);
            if (success) {
              record._readyToRemove = true;
              hasChanges = true;
            }
          } else {
            record._readyToRemove = true;
            hasChanges = true;
          }
        }
      }

      if (hasChanges) {
        dbData.bannedIps = dbData.bannedIps.filter(r => !r._readyToRemove);
        await saveCollectionFn('bannedIps', dbData.bannedIps);
        console.log('✅ [FortiGate Cron] База заблокированных IP успешно обновлена.');
      }
    } catch (e) {
      console.error('❌ [FortiGate Cron] Ошибка при проверке банов:', e.message);
    }
  };

  // Проверяем каждые 60 минут
  setInterval(processExpiredBans, 60 * 60 * 1000);
  
  // Выполним также сразу при старте (через 30 секунд после загрузки)
  setTimeout(processExpiredBans, 30000);
};
