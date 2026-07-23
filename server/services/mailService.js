import nodemailer from 'nodemailer';

let mailConfig = {
  host: '',
  port: 25,
  user: '',
  password: '',
  from: '',
  ssl: false,
  startTls: false,
  notificationReceivers: ''
};

let notificationEvents = {
  taskAssigned: true,
  taskStatusChanged: true,
  deadlineWarning: true,
  tokenExpiration: true
};

let transporter = null;

export function initMailService(dbData, saveCollection) {
  if (dbData.mailSettings) {
    mailConfig = { ...mailConfig, ...dbData.mailSettings };
  }
  if (dbData.notificationEvents) {
    notificationEvents = { ...notificationEvents, ...dbData.notificationEvents };
  }

  // Ensure settings are available in dbData
  dbData.mailSettings = mailConfig;
  dbData.notificationEvents = notificationEvents;

  console.log('📧 [MailService] Инициализация почтового сервиса (SMTP)');
  rebuildTransporter();
}

export function rebuildTransporter(newConfig = null) {
  if (newConfig) {
    mailConfig = { ...mailConfig, ...newConfig };
  }

  if (!mailConfig.host || !mailConfig.user || !mailConfig.password) {
    console.log('⚠️ [MailService] SMTP не настроен. Уведомления отправляться не будут.');
    transporter = null;
    return;
  }

  const opts = {
    host: mailConfig.host,
    port: parseInt(mailConfig.port, 10) || 25,
    secure: mailConfig.ssl === true || mailConfig.ssl === 'true',
    tls: {
      rejectUnauthorized: false
    }
  };

  if (mailConfig.user || mailConfig.password) {
    opts.auth = {
      user: mailConfig.user || '',
      pass: mailConfig.password || ''
    };
  }

  if (mailConfig.startTls === true || mailConfig.startTls === 'true') {
    opts.tls.ciphers = 'SSLv3';
  }

  transporter = nodemailer.createTransport(opts);
  console.log(`📧 [MailService] Транспорт пересоздан: ${mailConfig.host}:${mailConfig.port} (SSL: ${mailConfig.ssl}, TLS: ${mailConfig.startTls})`);
}

export async function testMailConnection(testConfig) {
  return new Promise((resolve, reject) => {
    const opts = {
      host: testConfig.host,
      port: parseInt(testConfig.port, 10) || 25,
      secure: testConfig.ssl === true || testConfig.ssl === 'true',
      tls: {
        rejectUnauthorized: false
      }
    };

    if (testConfig.user || testConfig.password) {
      opts.auth = {
        user: testConfig.user || '',
        pass: testConfig.password || ''
      };
    }

    if (testConfig.startTls === true || testConfig.startTls === 'true') {
      opts.tls.ciphers = 'SSLv3';
    }

    const testTransporter = nodemailer.createTransport(opts);
    testTransporter.verify((error, success) => {
      if (error) {
        console.error('❌ [MailService] Ошибка тестового соединения:', error);
        reject(error);
      } else {
        console.log('✅ [MailService] Тестовое соединение успешно установлено');
        resolve(success);
      }
    });
  });
}

// Универсальная функция отправки письма
export async function sendMail(to, subject, htmlContent) {
  if (!transporter) return;

  const mailOptions = {
    from: mailConfig.from || mailConfig.user,
    to: to,
    subject: `[Pulse 12] ${subject}`,
    html: htmlContent
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 [MailService] Письмо отправлено на ${to}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`❌ [MailService] Ошибка при отправке письма на ${to}:`, error);
    return false;
  }
}

// Рассылка системных уведомлений (администраторам)
export async function sendSystemAlertMail(subject, htmlContent, dbData) {
  if (!notificationEvents.tokenExpiration) return; // Если выключено

  // Автоматически находим всех администраторов в базе
  const admins = (dbData?.users || []).filter(u => 
    u.id === 'usr-1' || 
    u.roleType === 'admin' || 
    u.login?.toLowerCase() === 'admin'
  );

  const emailList = admins.map(a => a.email).filter(Boolean);
  
  if (emailList.length === 0) {
    console.log('⚠️ [MailService] Нет администраторов с указанной почтой для системного алерта.');
    return;
  }

  // Убираем дубликаты
  const uniqueEmails = [...new Set(emailList)];

  for (const email of uniqueEmails) {
    await sendMail(email, subject, htmlContent);
  }
}

// Отправка персонального уведомления по задаче (смена статуса / назначение)
export async function sendMailNotification(recipient, notifText, eventType) {
  // recipient - объект пользователя из базы (должен иметь поле email)
  if (!recipient || !recipient.email) return;

  // Проверка настроек
  if (eventType === 'taskAssigned' && !notificationEvents.taskAssigned) return;
  if (eventType === 'taskStatusChanged' && !notificationEvents.taskStatusChanged) return;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #0f172a; margin-top: 0;">Уведомление Pulse 12</h2>
      <p style="color: #334155; font-size: 16px; line-height: 1.5;">${notifText}</p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">Вы получили это письмо, так как являетесь участником корпоративной системы управления задачами Pulse 12.</p>
    </div>
  `;

  await sendMail(recipient.email, 'Новое уведомление', html);
}

// Отправка уведомления о дедлайне
export async function sendMailDeadlineWarning(recipient, task, timeRemainingLabel) {
  if (!recipient || !recipient.email) return;
  if (!notificationEvents.deadlineWarning) return;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f59e0b; border-radius: 8px; background-color: #fffbeb;">
      <h2 style="color: #d97706; margin-top: 0;">⚠️ Внимание! Горящий дедлайн!</h2>
      <p style="color: #334155; font-size: 16px; line-height: 1.5;">Уважаемый(ая) <b>${recipient.name || recipient.login}</b>,</p>
      <p style="color: #334155; font-size: 16px; line-height: 1.5;">
        Напоминаем, что срок сдачи задачи <strong>"${task.title}"</strong> истекает через <b>${timeRemainingLabel}</b>.
      </p>
      <p style="color: #334155; font-size: 16px; line-height: 1.5;">Текущий статус: <strong>${task.status}</strong></p>
      <hr style="border: 0; border-top: 1px solid #fcd34d; margin: 20px 0;" />
      <p style="color: #b45309; font-size: 12px; margin-bottom: 0;">Пожалуйста, актуализируйте статус задачи в системе Pulse 12.</p>
    </div>
  `;

  await sendMail(recipient.email, 'Горящий дедлайн по задаче', html);
}
