// Сервис отправки личных уведомлений в Telegram с автоматической привязкой аккаунтов

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

let lastUpdateId = 0;
let isPolling = false;
let dbReference = null;
let saveCollectionFn = null;

/**
 * Инициализация Telegram сервиса и запуск автопривязки
 */
export function initTelegramService(dbData, saveCollection) {
  dbReference = dbData;
  saveCollectionFn = saveCollection;

  if (!TELEGRAM_BOT_TOKEN) {
    console.log('💬 [TelegramService] Бот не подключен (TELEGRAM_BOT_TOKEN не указан)');
    return;
  }

  console.log('💬 [TelegramService] Telegram-бот активирован (запущен автоматический приёмник привязки аккаунтов)');
  startPolling();
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
      console.log(`💬 [TelegramService] Личное уведомление доставлено в Telegram (chat_id: ${chatId})`);
    }
  } catch (err) {
    console.warn('⚠️ [TelegramService] Ошибка отправки в Telegram:', err.message);
  }
}

/**
 * Отправка личного уведомления сотруднику
 */
export async function sendTelegramNotification(recipient, notif) {
  if (!TELEGRAM_BOT_TOKEN) return;

  const title = notif.title || 'Новая задача';
  const message = notif.message || '';
  const author = notif.creatorName || notif.author || 'Администратор';
  const due = notif.dueDate ? `\n⏰ <b>Срок (Дедлайн):</b> ${notif.dueDate}` : '';

  const text = `🏢 <b>Pulse 12 — Личное уведомление</b>\n\n` +
               `👤 <b>Исполнитель:</b> ${recipient ? recipient.name : ''}\n` +
               `✍️ <b>Назначил:</b> ${author}\n` +
               `📌 <b>${title}</b>${due}\n` +
               `${message ? `\n💬 <i>${message}</i>` : ''}`;

  // Отправляем строго лично сотруднику
  if (recipient && recipient.telegramChatId) {
    await sendTelegramMessage(recipient.telegramChatId, text);
  }
}

/**
 * Фоновый опрос (Polling) сообщений от сотрудников для автоматической привязки аккаунта
 */
function startPolling() {
  if (isPolling) return;
  isPolling = true;

  const pollLoop = async () => {
    while (isPolling && TELEGRAM_BOT_TOKEN) {
      try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=3`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            lastUpdateId = Math.max(lastUpdateId, update.update_id);

            if (update.message && update.message.text) {
              await handleIncomingMessage(update.message);
            }
          }
        }
      } catch (err) {
        // Ошибка соединения, ждём перед следующей попыткой
      }
      await new Promise(r => setTimeout(r, 2000));
    }
  };

  pollLoop();
}

/**
 * Обработка входящих сообщений от сотрудников в боте
 */
async function handleIncomingMessage(msg) {
  const chatId = String(msg.chat.id);
  const text = (msg.text || '').trim();

  // Очищаем команду /start, если она есть
  const query = text.replace(/^\/start\s*/i, '').trim().toLowerCase();

  if (!query || text === '/start') {
    await sendTelegramMessage(chatId, 
      `👋 <b>Добро пожаловать в корпоративный бот Pulse 12!</b>\n\n` +
      `Здесь вы будете получать личные конфиденциальные уведомления о ваших задачах.\n\n` +
      `👉 Чтобы привязать ваш аккаунт, просто <b>отправьте мне ваш корпоративный Email или логин</b> (например: <code>ivanov@enpf.kz</code>).`
    );
    return;
  }

  // Ищем сотрудника в базе по email или логину
  if (!dbReference || !dbReference.users) return;

  const matchedUser = dbReference.users.find(u =>
    (u.email && u.email.toLowerCase() === query) ||
    (u.login && u.login.toLowerCase() === query) ||
    (u.name && u.name.toLowerCase() === query)
  );

  if (matchedUser) {
    matchedUser.telegramChatId = chatId;
    if (saveCollectionFn) {
      await saveCollectionFn('users', dbReference.users);
    }
    await sendTelegramMessage(chatId,
      `✅ <b>Отлично, ${matchedUser.name}!</b>\n\n` +
      `Ваш аккаунт (<b>${matchedUser.email}</b>) успешно привязан к порталу Pulse 12.\n` +
      `Теперь все новые задачи будут конфиденциально приходить вам в этот личный чат.`
    );
    console.log(`💬 [TelegramService] Сотрудник ${matchedUser.name} привязал Telegram ID (${chatId})`);
  } else {
    await sendTelegramMessage(chatId,
      `⚠️ Сотрудник с почтой или логином «<b>${query}</b>» не найден в системе Pulse 12.\n\n` +
      `Пожалуйста, проверьте правильность написания корпоративного Email.`
    );
  }
}
