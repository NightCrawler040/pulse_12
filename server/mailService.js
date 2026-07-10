import nodemailer from 'nodemailer';

// Конфигурация SMTP (по умолчанию настроено под корпоративный сервер 172.31.0.153 на порту 25)
const SMTP_HOST = process.env.SMTP_HOST || '172.31.0.153';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '25', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'Корпоративный портал Pulse 12 <pulse-notify@company.local>';
const SMTP_ENABLED = process.env.SMTP_ENABLED !== 'false'; // По умолчанию включено, если есть доступ

let transporter = null;

/**
 * Инициализация SMTP транспорта
 */
export function initMailService() {
  if (!SMTP_ENABLED) {
    console.log('📧 [MailService] Отправка почты отключена (SMTP_ENABLED=false)');
    return;
  }

  try {
    const transportConfig = {
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465, // true для 465, false для остальных (25, 587)
      tls: {
        rejectUnauthorized: false // Для работы во внутренних сетях с самоподписанными сертификатами
      }
    };

    // Если указан логин/пароль — добавляем аутентификацию (иначе анонимная отправка по внутреннему релею)
    if (SMTP_USER && SMTP_PASS) {
      transportConfig.auth = {
        user: SMTP_USER,
        pass: SMTP_PASS
      };
    }

    transporter = nodemailer.createTransport(transportConfig);
    console.log(`📧 [MailService] Инициализирован SMTP-клиент (${SMTP_HOST}:${SMTP_PORT}${SMTP_USER ? ` как ${SMTP_USER}` : ' (анонимный релей)'})`);
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

  try {
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

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 [MailService] Уведомление о задаче отправлено на ${recipient.email} (ID: ${info.messageId})`);
  } catch (err) {
    console.warn(`⚠️ [MailService] Не удалось отправить письмо на ${recipient.email}: ${err.message}`);
  }
}
