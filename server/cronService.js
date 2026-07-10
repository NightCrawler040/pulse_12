// Cron-планировщик для автоматических напоминаний о горящих дедлайнах (dueDate)
// Проверяет задачи каждые 15 минут и отправляет предупреждения за 24 часа и за 2 часа до сдачи.

import { sendTelegramDeadlineWarning } from './telegramService.js';

const notified24h = new Set();
const notified2h = new Set();

/**
 * Инициализация и запуск планировщика дедлайнов
 * @param {Function} getDbDataFn - Функция получения актуальных данных БД
 */
export function initDeadlineCron(getDbDataFn) {
  console.log('⏰ [CronService] Запущен планировщик проверки дедлайнов (контроль 24ч и 2ч до сдачи задачи)');

  // Первый запуск через 15 секунд после старта сервера
  setTimeout(() => checkDeadlines(getDbDataFn), 15 * 1000);

  // Периодическая проверка каждые 15 минут
  setInterval(() => checkDeadlines(getDbDataFn), 15 * 60 * 1000);
}

async function checkDeadlines(getDbDataFn) {
  try {
    const dbData = getDbDataFn();
    if (!dbData || !Array.isArray(dbData.tasks)) return;

    const now = Date.now();

    for (const task of dbData.tasks) {
      // Игнорируем завершенные задачи и задачи без срока
      if (task.status === 'done' || !task.dueDate) continue;

      let dueTime = NaN;
      if (task.dueDate.includes('T')) {
        dueTime = new Date(task.dueDate).getTime();
      } else {
        // Если указана только дата (YYYY-MM-DD), считаем дедлайном конец дня 23:59:59
        dueTime = new Date(`${task.dueDate}T23:59:59`).getTime();
      }

      if (isNaN(dueTime)) continue;

      const diffMs = dueTime - now;
      const diffHours = diffMs / (1000 * 60 * 60);

      // Просроченные задачи пропускаем для алертов (или можно добавить отдельный алерт о просрочке)
      if (diffMs < 0) continue;

      // Находим исполнителя
      const recipient = (dbData.users || []).find(u => u.id === task.assigneeId && u.isActive !== false);

      // 1. Предупреждение за 2 часа (<= 2ч)
      if (diffHours <= 2 && !notified2h.has(task.id)) {
        notified2h.add(task.id);
        notified24h.add(task.id); // Чтобы 24ч тоже пометился
        console.log(`⏰ [CronService] Горящий дедлайн < 2ч для задачи "${task.title}" (Исполнитель: ${recipient?.name || task.assigneeId})`);
        await sendTelegramDeadlineWarning(recipient, task, 'менее 2 часов (⚡ Срочно!)');
        continue;
      }

      // 2. Предупреждение за 24 часа (<= 24ч и > 2ч)
      if (diffHours <= 24 && !notified24h.has(task.id)) {
        notified24h.add(task.id);
        console.log(`⏰ [CronService] Дедлайн < 24ч для задачи "${task.title}" (Исполнитель: ${recipient?.name || task.assigneeId})`);
        await sendTelegramDeadlineWarning(recipient, task, 'менее 24 часов');
      }
    }
  } catch (err) {
    console.error('❌ [CronService] Ошибка при проверке дедлайнов:', err.message);
  }
}
