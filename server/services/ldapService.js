import ldap from 'ldapjs';

/**
 * LDAP & Active Directory Integration Service for Pulse 12
 * Handles LDAP connection testing, synchronization, user merging by email/login, and automatic task reconciliation.
 */

const safeUnbind = (client) => {
  if (!client) return;
  try {
    client.unbind((err) => {});
  } catch (e) {}
};

export const testLdapConnection = async (settings) => {
  return new Promise((resolve) => {
    if (!settings || !settings.serverUrl) {
      return resolve({ success: false, error: 'Укажите URL сервера Active Directory (например, ldap://172.31.0.251)' });
    }

    const client = ldap.createClient({
      url: settings.serverUrl,
      timeout: 8000,
      connectTimeout: 8000
    });

    let finished = false;
    const finish = (result) => {
      if (finished) return;
      finished = true;
      safeUnbind(client);
      resolve(result);
    };

    client.on('error', (err) => {
      finish({ success: false, error: `Ошибка соединения с LDAP/AD: ${err.message}` });
    });

    const bindDn = settings.bindDN || settings.username || '';
    const bindPass = settings.bindPassword || settings.password || '';

    if (!bindDn) {
      return finish({ success: false, error: 'Укажите имя пользователя (bindDN или UPN) для подключения к Active Directory' });
    }

    client.bind(bindDn, bindPass, (err) => {
      if (err) {
        return finish({ success: false, error: `Ошибка аутентификации (bind): ${err.message}` });
      }

      if (!settings.baseDN) {
        return finish({ success: true, message: '✅ Подключение и авторизация в Active Directory прошли успешно!' });
      }

      const searchOptions = {
        filter: settings.userFilter || '(objectClass=person)',
        scope: 'sub',
        sizeLimit: 1
      };

      client.search(settings.baseDN, searchOptions, (searchErr, res) => {
        if (searchErr) {
          return finish({ success: true, message: `Подключение к LDAP успешно, но поиск в BaseDN (${settings.baseDN}) вернул предупреждение: ${searchErr.message}` });
        }

        res.on('searchEntry', () => {});
        res.on('searchReference', () => {});
        res.on('error', (resErr) => {
          if (resErr && (resErr.name === 'ReferralError' || resErr.code === 10 || resErr.name === 'SizeLimitExceededError' || resErr.code === 4)) {
            return finish({ success: true, message: '✅ Подключение и авторизация в Active Directory прошли успешно!' });
          }
          finish({ success: true, message: `✅ Подключение успешно, но поиск в BaseDN (${settings.baseDN}) выдал ошибку: ${resErr.message}` });
        });
        res.on('end', () => {
          finish({ success: true, message: '✅ Подключение и авторизация в Active Directory прошли успешно!' });
        });
      });
    });
  });
};

export const fetchLdapUsers = async (settings) => {
  return new Promise((resolve, reject) => {
    if (!settings || !settings.serverUrl || !settings.baseDN) {
      return reject(new Error('Не заполнены обязательные параметры (URL сервера и Base DN)'));
    }

    const client = ldap.createClient({
      url: settings.serverUrl,
      timeout: 15000,
      connectTimeout: 15000
    });

    let finished = false;
    const users = [];

    const finish = (err, result) => {
      if (finished) return;
      finished = true;
      safeUnbind(client);
      if (err) reject(err);
      else resolve(result);
    };

    client.on('error', (err) => {
      finish(err);
    });

    const bindDn = settings.bindDN || settings.username || '';
    const bindPass = settings.bindPassword || settings.password || '';

    client.bind(bindDn, bindPass, (bindErr) => {
      if (bindErr) {
        return finish(bindErr);
      }

      const loginAttr = settings.loginAttribute || 'userPrincipalName';
      const emailAttr = settings.emailAttribute || 'mail';
      const nameAttr = settings.nameAttribute || 'displayName';
      const deptAttr = settings.departmentAttribute || 'department';
      const objectClass = settings.objectClassUsers || 'person';

      const filter = settings.userFilter || `(&(objectClass=${objectClass})(!(objectClass=computer))(!(userAccountControl:1.2.840.113556.1.4.803:=2)))`;

      const searchOptions = {
        filter: filter,
        scope: 'sub',
        attributes: [loginAttr, emailAttr, nameAttr, deptAttr, 'sAMAccountName', 'userPrincipalName', 'mail', 'displayName', 'cn', 'department', 'distinguishedName']
      };

      client.search(settings.baseDN, searchOptions, (searchErr, res) => {
        if (searchErr) {
          return finish(searchErr);
        }

        res.on('searchEntry', (entry) => {
          const obj = entry.object || {};
          const dn = entry.dn?.toString() || obj.distinguishedName || '';
          
          const getVal = (attrName) => {
            if (!attrName || !obj[attrName]) return '';
            if (Array.isArray(obj[attrName])) return String(obj[attrName][0]).trim();
            return String(obj[attrName]).trim();
          };

          let email = getVal(emailAttr) || getVal('mail') || getVal('userPrincipalName');
          let login = getVal(loginAttr) || getVal('sAMAccountName') || getVal('userPrincipalName');
          let name = getVal(nameAttr) || getVal('displayName') || getVal('cn') || login;
          let department = getVal(deptAttr) || getVal('department') || 'Корпоративный отдел';

          if (login || email) {
            users.push({
              dn,
              login: login || email.split('@')[0],
              email: email || `${login}@${settings.domainName || 'enpf.kz'}`,
              name,
              department
            });
          }
        });

        res.on('searchReference', () => {
          // Игнорируем рефералы AD (например, DomainDnsZones / ForestDnsZones)
        });

        res.on('error', (err) => {
          if (err && (err.name === 'ReferralError' || err.code === 10 || err.name === 'SizeLimitExceededError' || err.code === 4)) {
            return finish(null, users);
          }
          finish(err);
        });

        res.on('end', () => {
          finish(null, users);
        });
      });
    });
  });
};

/**
 * Главный метод синхронизации с умной привязкой по почте и сохранением существующих ID (чтобы не ломать задачи)
 */
export const syncLdapUsersAndTasks = async (dbData, saveCollection, customSettings = null) => {
  const settings = customSettings || dbData.ldap_settings || {};
  const adUsers = await fetchLdapUsers(settings);

  let syncedCount = 0;
  let newUsersCount = 0;
  let updatedUsersCount = 0;
  let reconciledTasksCount = 0;
  let reconciledFindingsCount = 0;

  const usersMapByEmail = new Map();
  const usersMapByLogin = new Map();

  // 1. Индексируем существующих пользователей Pulse12 по почте и логину
  dbData.users.forEach(u => {
    if (u.email && u.email.trim()) {
      usersMapByEmail.set(u.email.trim().toLowerCase(), u);
    }
    if (u.login && u.login.trim()) {
      usersMapByLogin.set(u.login.trim().toLowerCase(), u);
    }
    if (u.id && u.id.trim()) {
      usersMapByLogin.set(u.id.trim().toLowerCase(), u);
    }
  });

  // 2. Обрабатываем каждого пользователя из Active Directory
  adUsers.forEach(adUser => {
    const cleanAdEmail = adUser.email ? adUser.email.trim().toLowerCase() : '';
    const cleanAdLogin = adUser.login ? adUser.login.trim().toLowerCase() : '';

    // Ищем существующую локальную учетку (сначала строго по почте, затем по логину)
    let matchedUser = null;
    if (cleanAdEmail && usersMapByEmail.has(cleanAdEmail)) {
      matchedUser = usersMapByEmail.get(cleanAdEmail);
    } else if (cleanAdLogin && usersMapByLogin.has(cleanAdLogin)) {
      matchedUser = usersMapByLogin.get(cleanAdLogin);
    } else if (cleanAdEmail && cleanAdEmail.includes('@') && usersMapByLogin.has(cleanAdEmail.split('@')[0])) {
      matchedUser = usersMapByLogin.get(cleanAdEmail.split('@')[0]);
    }

    if (matchedUser) {
      // КРИТИЧЕСКИ ВАЖНО: Мы сохраняем matchedUser.id неизменным, чтобы все задачи, где assigneeId === matchedUser.id, остались привязанными!
      matchedUser.email = adUser.email || matchedUser.email;
      matchedUser.login = adUser.login || matchedUser.login;
      matchedUser.name = adUser.name || matchedUser.name;
      matchedUser.department = adUser.department || matchedUser.department;
      matchedUser.ldapDn = adUser.dn;
      matchedUser.authSource = 'LDAP';
      matchedUser.isActive = true;
      
      // Обновляем индексы
      if (matchedUser.email) usersMapByEmail.set(matchedUser.email.trim().toLowerCase(), matchedUser);
      if (matchedUser.login) usersMapByLogin.set(matchedUser.login.trim().toLowerCase(), matchedUser);
      updatedUsersCount++;
    } else {
      // Создаем нового пользователя Active Directory
      const newId = `usr-ad-${cleanAdLogin || cleanAdEmail.split('@')[0] || Math.floor(Math.random() * 90000 + 10000)}`;
      const newUser = {
        id: newId,
        login: adUser.login || adUser.email.split('@')[0],
        email: adUser.email,
        name: adUser.name || adUser.login,
        department: adUser.department || 'Корпоративный отдел',
        role: 'Сотрудник',
        roleType: 'member',
        authSource: 'LDAP',
        ldapDn: adUser.dn,
        isActive: true,
        createdAt: new Date().toISOString()
      };
      dbData.users.push(newUser);
      if (newUser.email) usersMapByEmail.set(newUser.email.trim().toLowerCase(), newUser);
      if (newUser.login) usersMapByLogin.set(newUser.login.trim().toLowerCase(), newUser);
      newUsersCount++;
    }
    syncedCount++;
  });

  // 3. Автоматическая сверка и перепривязка задач (Task Reconciliation by Email / Login)
  // Если задача ранее была назначена по почтовому адресу (например, e.meiramov@enpf.kz) или логину (e.meiramov),
  // или если в assigneeId записан email — привязываем к реальному ID сотрудника!
  dbData.tasks.forEach(task => {
    let taskChanged = false;

    const checkAndReconcile = (val) => {
      if (!val) return null;
      const cleanVal = String(val).trim().toLowerCase();
      if (usersMapByEmail.has(cleanVal)) return usersMapByEmail.get(cleanVal);
      if (usersMapByLogin.has(cleanVal)) return usersMapByLogin.get(cleanVal);
      if (cleanVal.includes('@') && usersMapByLogin.has(cleanVal.split('@')[0])) {
        return usersMapByLogin.get(cleanVal.split('@')[0]);
      }
      return null;
    };

    // Проверка assigneeId / assigneeEmail
    const targetUser = checkAndReconcile(task.assigneeId) || checkAndReconcile(task.assigneeEmail) || checkAndReconcile(task.assigneeName);
    if (targetUser) {
      if (task.assigneeId !== targetUser.id || task.assigneeEmail !== targetUser.email || task.assigneeName !== targetUser.name) {
        task.assigneeId = targetUser.id;
        task.assigneeName = targetUser.name;
        if (targetUser.email) task.assigneeEmail = targetUser.email;
        taskChanged = true;
      }
    }

    // Проверка комментариев
    if (Array.isArray(task.comments)) {
      task.comments.forEach(comment => {
        const commentUser = checkAndReconcile(comment.userId) || checkAndReconcile(comment.userEmail);
        if (commentUser && comment.userId !== commentUser.id) {
          comment.userId = commentUser.id;
          comment.userName = commentUser.name;
          taskChanged = true;
        }
      });
    }

    if (taskChanged) {
      reconciledTasksCount++;
    }
  });

  // 4. Сверка инцидентов безопасности (DerScanner / SIEM / WAF) по почте/логину
  dbData.findings.forEach(finding => {
    if (finding.assignee) {
      const cleanAss = String(finding.assignee).trim().toLowerCase();
      let matched = null;
      if (usersMapByEmail.has(cleanAss)) matched = usersMapByEmail.get(cleanAss);
      else if (usersMapByLogin.has(cleanAss)) matched = usersMapByLogin.get(cleanAss);
      else if (cleanAss.includes('@') && usersMapByLogin.has(cleanAss.split('@')[0])) {
        matched = usersMapByLogin.get(cleanAss.split('@')[0]);
      }

      if (matched && finding.assignee !== (matched.login || matched.id)) {
        finding.assignee = matched.login || matched.id;
        reconciledFindingsCount++;
      }
    }
  });

  // Сохраняем обновленные коллекции
  await saveCollection('users', dbData.users);
  if (reconciledTasksCount > 0) {
    await saveCollection('tasks', dbData.tasks);
  }
  if (reconciledFindingsCount > 0) {
    await saveCollection('findings', dbData.findings);
  }

  return {
    syncedCount,
    newUsersCount,
    updatedUsersCount,
    reconciledTasksCount,
    reconciledFindingsCount,
    totalUsersCount: dbData.users.length
  };
};

export const authenticateLdapUser = async (loginInput, passwordInput, settings) => {
  return new Promise((resolve) => {
    if (!settings || !settings.serverUrl || !settings.baseDN) {
      return resolve(null);
    }

    const client = ldap.createClient({
      url: settings.serverUrl,
      timeout: 6000,
      connectTimeout: 6000
    });

    client.on('error', () => resolve(null));

    const cleanLogin = String(loginInput || '').trim();
    const cleanPass = String(passwordInput || '').trim();

    if (!cleanLogin || !cleanPass) {
      client.unbind();
      return resolve(null);
    }

    // Если передан полный UPN (user@domain.kz) или DN — пробуем прямой bind
    // Иначе сначала биндимся под сервисным bindDN, ищем DN пользователя, и затем биндимся под ним
    const serviceBindDn = settings.bindDN || settings.username || '';
    const serviceBindPass = settings.bindPassword || settings.password || '';

    if (!serviceBindDn) {
      // Попытка прямого bind под переданным логином/UPN
      const tryUpn = cleanLogin.includes('@') ? cleanLogin : `${cleanLogin}@${settings.domainName || 'enpf.kz'}`;
      client.bind(tryUpn, cleanPass, (err) => {
        if (err) {
          client.unbind();
          return resolve(null);
        }
        client.unbind();
        resolve({ login: cleanLogin, email: tryUpn, authSource: 'LDAP' });
      });
      return;
    }

    client.bind(serviceBindDn, serviceBindPass, (bindErr) => {
      if (bindErr) {
        client.unbind();
        return resolve(null);
      }

      const loginAttr = settings.loginAttribute || 'userPrincipalName';
      const emailAttr = settings.emailAttribute || 'mail';
      const nameAttr = settings.nameAttribute || 'displayName';
      const deptAttr = settings.departmentAttribute || 'department';

      const filter = cleanLogin.includes('@')
        ? `(|(${emailAttr}=${cleanLogin})(${loginAttr}=${cleanLogin})(mail=${cleanLogin})(userPrincipalName=${cleanLogin}))`
        : `(|(${loginAttr}=${cleanLogin})(sAMAccountName=${cleanLogin})(userPrincipalName=${cleanLogin}))`;

      client.search(settings.baseDN, { filter, scope: 'sub', sizeLimit: 1 }, (searchErr, res) => {
        if (searchErr) {
          client.unbind();
          return resolve(null);
        }

        let userEntry = null;

        res.on('searchEntry', (entry) => {
          userEntry = entry;
        });

        res.on('end', () => {
          if (!userEntry) {
            client.unbind();
            return resolve(null);
          }

          const userDn = userEntry.dn?.toString() || userEntry.object.distinguishedName || '';
          if (!userDn) {
            client.unbind();
            return resolve(null);
          }

          // Проверяем пароль пользователя прямым bind под его DN
          const userClient = ldap.createClient({ url: settings.serverUrl, timeout: 5000 });
          userClient.on('error', () => resolve(null));
          userClient.bind(userDn, cleanPass, (userBindErr) => {
            if (userBindErr) {
              userClient.unbind();
              client.unbind();
              return resolve(null);
            }

            const obj = userEntry.object;
            const getVal = (attr) => (obj[attr] ? (Array.isArray(obj[attr]) ? obj[attr][0] : obj[attr]) : '');

            const email = getVal(emailAttr) || getVal('mail') || getVal('userPrincipalName') || '';
            const login = getVal(loginAttr) || getVal('sAMAccountName') || cleanLogin;
            const name = getVal(nameAttr) || getVal('displayName') || getVal('cn') || login;
            const department = getVal(deptAttr) || getVal('department') || 'Корпоративный отдел';

            userClient.unbind();
            client.unbind();
            resolve({
              dn: userDn,
              login,
              email,
              name,
              department,
              authSource: 'LDAP'
            });
          });
        });
      });
    });
  });
};
