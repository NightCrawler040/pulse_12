import nodemailer from 'nodemailer';

// Конфигурация SMTP (по умолчанию настроено под корпоративный сервер 172.31.0.153 на порту 25)
const SMTP_HOST = process.env.SMTP_HOST || '172.31.0.153';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '25', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'Корпоративный портал Pulse 12 <pulse-notify@enpf.kz>';
const SMTP_ENABLED = process.env.SMTP_ENABLED !== 'false';

let transporter = null;
let fallbackTransporter = null;

/**
 * Инициализация SMTP транспорта
 */
export function initMailService() {
  if (!SMTP_ENABLED) {
    console.log('📧 [MailService] Отправка почты отключена (SMTP_ENABLED=false)');
    return;
  }

  try {
    // Основной транспорт (для внутреннего порта 25 отключаем STARTTLS по умолчанию, чтобы избежать сброса сокета Exchange)
    const baseConfig = {
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      ignoreTLS: SMTP_PORT === 25, // Отключаем STARTTLS на 25 порту (решает ошибку Unexpected socket close)
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      tls: {
        rejectUnauthorized: false
      }
    };

    if (SMTP_USER && SMTP_PASS) {
      baseConfig.auth = {
        user: SMTP_USER,
        pass: SMTP_PASS
      };
    }

    transporter = nodemailer.createTransport(baseConfig);

    // Резервный транспорт на случай, если сервер наоборот требует STARTTLS
    const fallbackConfig = {
      ...baseConfig,
      ignoreTLS: false,
      requireTLS: false
    };
    fallbackTransporter = nodemailer.createTransport(fallbackConfig);

    console.log(`📧 [MailService] Инициализирован SMTP-клиент (${SMTP_HOST}:${SMTP_PORT}, ignoreTLS=${SMTP_PORT === 25})`);
  } catch (err) {
    console.warn('⚠️ [MailService] Ошибка инициализации почтового клиента:', err.message);
    transporter = null;
  }
}

/**
 * Отправка уведомления о назначении новой задачи сотруднику
 */
export async function sendTaskNotificationEmail(recipient, task, senderName = 'Администратор') {
  if (!transporter || !recipient || !recipient.email) return;

  const mailOptions = {
    from: SMTP_FROM,
    to: recipient.email,
    subject: `[Pulse 12] Новая задача: ${task.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1e29; color: #f1f5f9; padding: 24px; border-radius: 12px; border: 1px solid #334155;">
        <div style="border-bottom: 1px solid #334155; padding-bottom: 16px; margin-bottom: 20px;">
          <h2 style="color: #60a5fa; margin: 0;">🏢 Корпоративная платформа Pulse 12</h2>
        </div>
        <p style="font-size: 16px;">Здравствуйте, <strong>${recipient.name}</strong>!</p>
        <p style="font-size: 15px; color: #cbd5e1;">На вас назначена новая задача от сотрудника <strong>${senderName}</strong>:</p>
        <div style="background: #0f172a; padding: 16px; border-radius: 8px; border-left: 4px solid #3b82f6; margin: 20px 0;">
          <h3 style="margin: 0 0 8px 0; color: #f8fafc;">${task.title}</h3>
          <p style="margin: 0; color: #94a3b8; font-size: 14px;">${task.description || 'Описание отсутствует'}</p>
          <div style="margin-top: 12px; font-size: 13px; color: #64748b;">
            Приоритет: <strong style="color: #38bdf8;">${task.priority?.toUpperCase() || 'NORMAL'}</strong>
          </div>
        </div>
        <p style="font-size: 13px; color: #64748b; margin-top: 24px;">
          Для просмотра задачи перейдите на корпоративный портал Pulse 12.
        </p>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 [MailService] Уведомление успешно отправлено на ${recipient.email} (ID: ${info.messageId})`);
  } catch (err) {
    // Если первая попытка упала (например из-за сокета), пробуем fallback
    console.warn(`⚠️ [MailService] Первая попытка отправки на ${recipient.email} не удалась (${err.message}), пробуем альтернативный режим TLS...`);
    try {
      if (fallbackTransporter) {
        const info2 = await fallbackTransporter.sendMail(mailOptions);
        console.log(`📧 [MailService] Уведомление успешно отправлено на ${recipient.email} (fallback ID: ${info2.messageId})`);
      }
    } catch (err2) {
      console.warn(`⚠️ [MailService] Не удалось отправить письмо на ${recipient.email}: ${err2.message}`);
    }
  }
}
