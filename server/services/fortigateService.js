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

    console.log(`✅ [FortiGate] Успешный запрос к вебхуку для IP ${ip}. Статус: ${response.status}`);
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
  
  console.log(`🔒 [FortiGate] Отправка команды на БЛОКИРОВКУ IP: ${ip} (в группу: ${settings.addressGroup || 'Pulse_Banned_IPs'})`);
  return await triggerFortigateWebhook(settings.banUrl, settings.apiToken, ip, fortigateGroup || settings.addressGroup);
};

/**
 * Снятие блокировки с IP-адреса
 */
export const unbanIpAddress = async (settings, ip, fortigateGroup = null) => {
  if (!settings.enabled || !settings.unbanUrl) {
    console.log(`⚠️ [FortiGate] Снятие блокировки пропущено. Интеграция выключена или URL не задан.`);
    return false;
  }

  console.log(`🔓 [FortiGate] Отправка команды на РАЗБЛОКИРОВКУ IP: ${ip} (из группы: ${settings.addressGroup || 'Pulse_Banned_IPs'})`);
  return await triggerFortigateWebhook(settings.unbanUrl, settings.apiToken, ip, fortigateGroup || settings.addressGroup);
};


/**
 * Allocates a FortiGate group for an IP based on current database capacity
 */
export const allocateFortigateGroup = (bannedIps, isPermanent, settings) => {
  const permGroup = settings.permGroup || 'Pulse_Perm';
  if (isPermanent) {
    return permGroup;
  }

  const tempGroups = settings.tempGroups || ['Pulse_Temp_1', 'Pulse_Temp_2', 'Pulse_Temp_3'];
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
