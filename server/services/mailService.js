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

  if (!mailConfig.host || !mailConfig.from) {
    console.log('⚠️ [MailService] SMTP не настроен. Уведомления отправляться не будут.');
    transporter = null;
    return;
  }

  const opts = {
    host: mailConfig.host,
    port: parseInt(mailConfig.port, 10) || 25,
    secure: mailConfig.ssl === true || mailConfig.ssl === 'true',
    name: 'pulse.enpf.kz',
    ignoreTLS: !(mailConfig.startTls === true || mailConfig.startTls === 'true'),
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
      name: 'pulse.enpf.kz',
      ignoreTLS: !(testConfig.startTls === true || testConfig.startTls === 'true'),
      logger: true,
      debug: true,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
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
export async function sendMailNotification(recipient, notifText, eventType, task = null) {
  // recipient - объект пользователя из базы (должен иметь поле email)
  if (!recipient || !recipient.email) return;

  // Проверка настроек
  if (eventType === 'taskAssigned' && !notificationEvents.taskAssigned) return;
  if (eventType === 'taskStatusChanged' && !notificationEvents.taskStatusChanged) return;

  let taskDetailsHtml = '';
  if (task) {
    const formattedDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString('ru-RU') : 'Не указан';
    
    // Формируем список подзадач, если они есть
    let subtasksHtml = '';
    if (task.subtasks && task.subtasks.length > 0) {
      const subtasksList = task.subtasks.map(st => 
        `<li style="margin-bottom: 4px;">${st.completed ? '✅' : '⬜'} ${st.title}</li>`
      ).join('');
      subtasksHtml = `
        <div style="margin-top: 15px;">
          <strong style="color: #475569; font-size: 14px;">Подзадачи:</strong>
          <ul style="list-style-type: none; padding-left: 0; margin-top: 8px; font-size: 14px; color: #334155;">
            ${subtasksList}
          </ul>
        </div>
      `;
    }

    taskDetailsHtml = `
      <div style="margin-top: 20px; background-color: #f8fafc; border-radius: 6px; padding: 15px; border: 1px solid #e2e8f0;">
        <h3 style="margin-top: 0; color: #1e293b; font-size: 16px;">${task.title} <span style="color: #64748b; font-size: 14px; font-weight: normal;">(${task.id})</span></h3>
        
        <div style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 15px;">
          <div style="background-color: #fff; padding: 8px 12px; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 13px;">
            <span style="color: #64748b; display: block; margin-bottom: 2px;">Статус</span>
            <strong style="color: #0f172a;">${task.status || 'К выполнению'}</strong>
          </div>
          <div style="background-color: #fff; padding: 8px 12px; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 13px;">
            <span style="color: #64748b; display: block; margin-bottom: 2px;">Приоритет</span>
            <strong style="color: #0f172a;">${task.priority || 'medium'}</strong>
          </div>
          <div style="background-color: #fff; padding: 8px 12px; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 13px;">
            <span style="color: #64748b; display: block; margin-bottom: 2px;">Дедлайн</span>
            <strong style="color: #ef4444;">${formattedDate}</strong>
          </div>
        </div>

        <strong style="color: #475569; font-size: 14px;">Описание:</strong>
        <div style="margin-top: 8px; font-size: 14px; color: #334155; line-height: 1.6; white-space: pre-wrap;">${task.description || 'Нет описания'}</div>
        
        ${subtasksHtml}
      </div>
    `;
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #0f172a; margin-top: 0;">Уведомление Pulse 12</h2>
      <p style="color: #334155; font-size: 16px; line-height: 1.5;">${notifText}</p>
      
      ${taskDetailsHtml}
      
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">Вы получили это письмо, так как являетесь участником корпоративной системы управления задачами Pulse 12.</p>
    </div>
  `;

  await sendMail(recipient.email, 'Новое уведомление по задаче', html);
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
