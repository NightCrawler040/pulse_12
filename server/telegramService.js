// Сервис отправки уведомлений в Telegram для корпоративного портала Pulse 12

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || ''; // Общий чат команды (если указан)

/**
 * Инициализация и проверка статуса Telegram бота
 */
export function initTelegramService() {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log('💬 [TelegramService] Бот не подключен (TELEGRAM_BOT_TOKEN не указан в .env)');
    return;
  }
  console.log(`💬 [TelegramService] Telegram-бот активирован${TELEGRAM_CHAT_ID ? ` (Общий чат: ${TELEGRAM_CHAT_ID})` : ''}`);
}

/**
 * Отправка сообщения в Telegram по API
 */
async function sendTelegramMessage(chatId, text) {
  if (!TELEGRAM_BOT_TOKEN || !chatId) return;

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML'
      })
    });

    const data = await response.json();
    if (!data.ok) {
      console.warn(`⚠️ [TelegramService] Ошибка от Telegram API (${chatId}):`, data.description);
    } else {
      console.log(`💬 [TelegramService] Уведомление успешно доставлено в Telegram (chat_id: ${chatId})`);
    }
  } catch (err) {
    console.warn('⚠️ [TelegramService] Ошибка отправки в Telegram:', err.message);
  }
}

/**
 * Отправка уведомления сотруднику или в общий чат о назначении задачи / событии
 */
export async function sendTelegramNotification(recipient, notif) {
  if (!TELEGRAM_BOT_TOKEN) return;

  const title = notif.title || 'Новое уведомление';
  const message = notif.message || '';

  const text = `🏢 <b>Pulse 12 — Уведомление</b>\n\n` +
               `👤 <b>Сотрудник:</b> ${recipient ? recipient.name : 'Команда'}\n` +
               `📌 <b>${title}</b>\n` +
               `${message ? `💬 <i>${message}</i>` : ''}`;

  // 1. Отправляем лично сотруднику, если у него указан telegramChatId
  if (recipient && recipient.telegramChatId) {
    await sendTelegramMessage(recipient.telegramChatId, text);
  }

  // 2. Отправляем в общий чат команды, если указан TELEGRAM_CHAT_ID
  if (TELEGRAM_CHAT_ID) {
    await sendTelegramMessage(TELEGRAM_CHAT_ID, text);
  }
}
