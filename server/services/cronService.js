import { saveCollection, getAllData } from '../db.js';
import { unbanIpAddress } from './fortigateService.js';

let cronInterval = null;

export const startCronService = () => {
  if (cronInterval) clearInterval(cronInterval);

  console.log('🕒 [Cron] Запуск фонового планировщика задач (проверка раз в 1 час)...');
  
  // Проверяем раз в час (3600000 ms)
  cronInterval = setInterval(async () => {
    try {
      const dbData = await getAllData();
      const bannedIps = dbData.bannedIps || [];
      const fortigateSettings = dbData.fortigateSettings || {};
      
      if (!fortigateSettings.enabled || !fortigateSettings.unbanUrl) {
        return;
      }

      const now = Date.now();
      let updatedBannedIps = [...bannedIps];
      let hasChanges = false;

      for (let i = 0; i < bannedIps.length; i++) {
        const banRecord = bannedIps[i];
        if (banRecord.expiresAt && banRecord.expiresAt <= now) {
          console.log(`⏰ [Cron] Истек срок блокировки для IP: ${banRecord.ip}. Отправка команды на разблокировку...`);
          const success = await unbanIpAddress(fortigateSettings, banRecord.ip);
          if (success) {
            // Удаляем из списка
            updatedBannedIps = updatedBannedIps.filter(b => b.ip !== banRecord.ip);
            hasChanges = true;
          }
        }
      }

      if (hasChanges) {
        await saveCollection('bannedIps', updatedBannedIps);
        console.log('✅ [Cron] База данных Banned IPs обновлена.');
      }
      
    } catch (err) {
      console.error('❌ [Cron] Ошибка в фоновом планировщике:', err.message);
    }
  }, 3600000); // 1 час
};

export const stopCronService = () => {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
    console.log('🕒 [Cron] Фоновый планировщик остановлен.');
  }
};
