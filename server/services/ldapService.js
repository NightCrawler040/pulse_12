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

// Вспомогательная функция для автоматического разрешения имен групп AD (например internetdkb) в полный DN
const resolveGroupFilter = async (client, baseDN, rawFilter) => {
  if (!rawFilter || typeof rawFilter !== 'string') return rawFilter;
  let resolvedFilter = rawFilter.trim();

  // Если ввели просто "group:internetdkb" или "group=internetdkb"
  if (/^group[:=](.+)$/i.test(resolvedFilter)) {
    const gName = resolvedFilter.replace(/^group[:=]/i, '').trim();
    resolvedFilter = `memberOf=${gName}`;
  } else if (/^[a-zA-Z0-9_\-\.а-яА-Я]+$/.test(resolvedFilter) && resolvedFilter.toLowerCase() !== 'person' && resolvedFilter.toLowerCase() !== 'user') {
    // Если ввели просто одно слово вроде "internetdkb", ищем его либо как группу, либо в названии отдела
    resolvedFilter = `(|(memberOf=${resolvedFilter})(department=*${resolvedFilter}*))`;
  }

  // Ищем в фильтре конструкции memberOf=имяГруппы или memberOf=*имяГруппы* или group=имяГруппы
  const groupRegex = /(?:memberOf|group|groupName)[:=][\*]*([^)\*]+)[\*]*/gi;
  let match;
  let filterWithGroupDns = resolvedFilter;

  while ((match = groupRegex.exec(resolvedFilter)) !== null) {
    const fullMatch = match[0];
    const groupName = match[1].trim();
    if (!groupName || groupName.toUpperCase().startsWith('CN=')) continue;

    const groupDn = await new Promise((resolve) => {
      try {
        const groupSearchFilter = `(&(objectClass=group)(|(sAMAccountName=${groupName})(cn=${groupName})(displayName=${groupName})))`;
        client.search(baseDN, { filter: groupSearchFilter, scope: 'sub', sizeLimit: 1 }, (err, res) => {
          if (err) return resolve(null);
          let foundDn = null;
          res.on('searchEntry', (entry) => {
            if (!foundDn) foundDn = entry.dn?.toString() || entry.object?.distinguishedName || entry.object?.distinguishedname || '';
          });
          res.on('error', () => resolve(foundDn));
          res.on('end', () => resolve(foundDn));
        });
      } catch (e) {
        resolve(null);
      }
    });

    if (groupDn) {
      console.log(`🔍 [LDAP Group Resolve] Группа AD "${groupName}" разрешена в DN: ${groupDn}`);
      // Используем LDAP_MATCHING_RULE_IN_CHAIN (1.2.840.113556.1.4.1941) для нахождения членов группы и всех ее подгрупп
      filterWithGroupDns = filterWithGroupDns.replace(fullMatch, `(|(memberOf=${groupDn})(memberOf:1.2.840.113556.1.4.1941:=${groupDn}))`);
    } else {
      console.warn(`⚠️ [LDAP Group Resolve] Группа AD "${groupName}" не найдена в BaseDN: ${baseDN}. Поиск продолжится с исходным фильтром.`);
    }
  }

  return filterWithGroupDns;
};

export const testLdapConnection = async (settings) => {
  return new Promise((resolve) => {
    if (!settings || !settings.serverUrl) {
      return resolve({ success: false, error: 'Укажите URL сервера Active Directory (например, ldap://172.31.0.251)' });
    }

    const client = ldap.createClient({
      url: settings.serverUrl,
      timeout: 45000,
      connectTimeout: 15000
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

    client.bind(bindDn, bindPass, async (err) => {
      if (err) {
        return finish({ success: false, error: `Ошибка аутентификации (bind): ${err.message}` });
      }

      try {
        if (!settings.baseDN) {
          return finish({ success: true, message: '✅ Подключение и авторизация в Active Directory прошли успешно!' });
        }

        const rawUserFilter = settings.userFilter || '(objectClass=person)';
        const resolvedTestFilter = await resolveGroupFilter(client, settings.baseDN, rawUserFilter);

        const searchOptions = {
          filter: resolvedTestFilter,
          scope: 'sub',
          sizeLimit: 1
        };

        client.search(settings.baseDN, searchOptions, (searchErr, res) => {
          if (searchErr) {
            if (searchErr.message && (searchErr.message.includes('timeout') || searchErr.message.includes('interrupt'))) {
              return finish({ success: true, message: '✅ Подключение и авторизация в Active Directory прошли успешно! (Поиск в корне домена занял больше 45с из-за объема AD, можно сузить BaseDN или фильтр)' });
            }
            return finish({ success: true, message: `Подключение к LDAP успешно, но поиск в BaseDN (${settings.baseDN}) вернул предупреждение: ${searchErr.message}` });
          }

          res.on('searchEntry', () => {});
          res.on('searchReference', () => {});
          res.on('error', (resErr) => {
            if (resErr && (resErr.name === 'ReferralError' || resErr.code === 10 || resErr.name === 'SizeLimitExceededError' || resErr.code === 4 || (resErr.message && (resErr.message.includes('timeout') || resErr.message.includes('interrupt'))))) {
              return finish({ success: true, message: '✅ Подключение и авторизация в Active Directory прошли успешно!' });
            }
            finish({ success: true, message: `✅ Подключение успешно, но поиск в BaseDN (${settings.baseDN}) выдал ошибку: ${resErr.message}` });
          });
          res.on('end', () => {
            finish({ success: true, message: '✅ Подключение и авторизация в Active Directory прошли успешно!' });
          });
        });
      } catch (innerErr) {
        finish({ success: false, error: `Ошибка при проверке AD: ${innerErr.message}` });
      }
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
      timeout: 45000,
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

    client.bind(bindDn, bindPass, async (bindErr) => {
      if (bindErr) {
        return finish(bindErr);
      }

      try {
        const cleanAttr = (attr) => (attr ? String(attr).trim() : '');
        const loginAttr = cleanAttr(settings.loginAttribute || 'userPrincipalName');
        const emailAttr = cleanAttr(settings.emailAttribute || 'mail');
        const nameAttr = cleanAttr(settings.nameAttribute || 'displayName');
        const deptAttr = cleanAttr(settings.departmentAttribute || 'department');
        const objectClass = cleanAttr(settings.objectClassUsers || 'person');

        const rawUserFilter = settings.userFilter || `(&(objectClass=${objectClass})(!(objectClass=computer))(!(userAccountControl:1.2.840.113556.1.4.803:=2)))`;
        const resolvedFilter = await resolveGroupFilter(client, settings.baseDN, rawUserFilter);

        let filterToUse = resolvedFilter;
        if (!filterToUse.includes('(objectClass=')) {
          filterToUse = `(&(objectClass=${objectClass})(!(objectClass=computer))(!(userAccountControl:1.2.840.113556.1.4.803:=2))(${filterToUse}))`;
        } else if (resolvedFilter !== rawUserFilter && !rawUserFilter.includes('objectClass=')) {
          filterToUse = `(&(objectClass=${objectClass})(!(objectClass=computer))(!(userAccountControl:1.2.840.113556.1.4.803:=2))(${resolvedFilter}))`;
        }

        const attributesSet = new Set([
          'sAMAccountName',
          'userPrincipalName',
          'mail',
          'displayName',
          'cn',
          'department',
          'distinguishedName',
          'objectClass',
          'objectCategory',
          'userAccountControl'
        ]);

        [loginAttr, emailAttr, nameAttr, deptAttr].forEach(attr => {
          if (attr) {
            attr.split(/[,;\s]+/).forEach(part => {
              const cleanPart = part.trim();
              if (/^[a-zA-Z0-9\-]+$/.test(cleanPart)) {
                attributesSet.add(cleanPart);
              }
            });
          }
        });

        const searchOptions = {
          filter: filterToUse,
          scope: 'sub',
          paged: true,
          sizeLimit: 1000,
          attributes: Array.from(attributesSet)
        };

        client.search(settings.baseDN, searchOptions, (searchErr, res) => {
          if (searchErr) {
            return finish(searchErr);
          }

          res.on('searchEntry', (entry) => {
            const obj = entry.object || {};
            const dn = entry.dn?.toString() || obj.distinguishedName || obj.distinguishedname || '';
            
            const getVal = (attrName) => {
              if (!attrName) return '';
              // 1. Попытка точного совпадения или регистронезависимого поиска в entry.object
              let val = obj[attrName];
              if (!val && typeof obj === 'object') {
                const lowerKey = attrName.toLowerCase();
                const foundKey = Object.keys(obj).find(k => k.toLowerCase() === lowerKey);
                if (foundKey) val = obj[foundKey];
              }
              // 2. Попытка поиска в entry.attributes (стандарт ldapjs)
              if (!val && Array.isArray(entry.attributes)) {
                const attr = entry.attributes.find(a => (a.type || a.name || '').toLowerCase() === attrName.toLowerCase());
                if (attr && attr.values && attr.values.length > 0) {
                  val = attr.values;
                } else if (attr && attr.vals && attr.vals.length > 0) {
                  val = attr.vals;
                }
              }
              if (!val) return '';
              if (Array.isArray(val)) return String(val[0]).trim();
              return String(val).trim();
            };

            let login = getVal(loginAttr) || getVal('sAMAccountName') || getVal('userPrincipalName');
            let email = getVal(emailAttr) || getVal('mail') || getVal('userPrincipalName');
            let name = getVal(nameAttr) || getVal('displayName') || getVal('cn');
            let department = getVal(deptAttr) || getVal('department') || 'Корпоративный отдел';

            // --- АВТОМАТИЧЕСКАЯ ФИЛЬТРАЦИЯ СИСТЕМ И КОМПЬЮТЕРОВ (ОСТАВЛЯЕМ ТОЛЬКО ЛЮДЕЙ!) ---
            // 1. Если sAMAccountName или логин заканчивается на $ (например, WEB-01$ или KRBTGT$) — это компьютер или сервис!
            if (login.endsWith('$') || dn.includes('CN=Computers') || dn.includes('OU=Domain Controllers')) {
              return;
            }
            // 2. Исключаем системные почтовые ящики Exchange (HealthMailbox, SystemMailbox, SM_*, CAS_*)
            if (/^(HealthMailbox|SystemMailbox|SM_|CAS_|MSOL_|krbtgt)/i.test(login) || /^(HealthMailbox|SystemMailbox)/i.test(name)) {
              return;
            }
            // 3. Проверяем objectClass (если это computer или group — пропускаем)
            const objClassStr = String(getVal('objectClass') || '').toLowerCase();
            if (objClassStr.includes('computer') || objClassStr.includes('group') || objClassStr.includes('organizationalunit') || objClassStr.includes('msds-groupmanagedserviceaccount')) {
              return;
            }
            // 4. Проверяем флаги отключения или системности (userAccountControl: если установлен бит 2 - account disabled)
            const uac = parseInt(getVal('userAccountControl') || '0', 10);
            if (uac > 0 && (uac & 2) !== 0) {
              // Учетная запись отключена (Account Disabled)
              return;
            }

            // Если есть хотя бы логин, почта или имя (CN) — сохраняем сотрудника!
            if (!login && !email && name) {
              login = getVal('sAMAccountName') || getVal('cn') || (dn.split(',')[0].replace(/CN=/i, '').trim()) || `user_${Date.now()}`;
            }

            if (login || email || name) {
              users.push({
                dn,
                login: login || (email ? email.split('@')[0] : `user_${users.length + 1}`),
                email: email || `${login}@${settings.domainName || 'enpf.kz'}`,
                name: name || login || email,
                department
              });
            }
          });

          res.on('searchReference', () => {
            // Игнорируем рефералы AD (например, DomainDnsZones / ForestDnsZones)
          });

          res.on('error', (err) => {
            if (err && (err.name === 'ReferralError' || err.code === 10 || err.name === 'SizeLimitExceededError' || err.code === 4 || err.name === 'TimeLimitExceededError' || err.code === 3 || (err.message && (err.message.toLowerCase().includes('timeout') || err.message.toLowerCase().includes('limit exceeded'))))) {
              return finish(null, users);
            }
            finish(err);
          });

          res.on('end', () => {
            finish(null, users);
          });
        });
      } catch (innerErr) {
        finish(innerErr);
      }
    });
  });
};

export const reconcileAndSaveLdapUsers = async (dbData, saveCollection, adUsers, settings = {}) => {
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
      const newId = `usr-ad-${cleanAdLogin || (cleanAdEmail ? cleanAdEmail.split('@')[0] : '') || Math.floor(Math.random() * 90000 + 10000)}`;
      const newUser = {
        id: newId,
        login: adUser.login || (adUser.email ? adUser.email.split('@')[0] : `user_${Date.now()}`),
        email: adUser.email || `${adUser.login || 'user'}@${settings.domainName || 'enpf.kz'}`,
        name: adUser.name || adUser.login || adUser.email,
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

    const targetUser = checkAndReconcile(task.assigneeId) || checkAndReconcile(task.assigneeEmail) || checkAndReconcile(task.assigneeName);
    if (targetUser) {
      if (task.assigneeId !== targetUser.id || task.assigneeEmail !== targetUser.email || task.assigneeName !== targetUser.name) {
        task.assigneeId = targetUser.id;
        task.assigneeName = targetUser.name;
        if (targetUser.email) task.assigneeEmail = targetUser.email;
        taskChanged = true;
      }
    }

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

  // 4. Сверка инцидентов безопасности
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

export const syncLdapUsersAndTasks = async (dbData, saveCollection, customSettings = null) => {
  const settings = customSettings || dbData.ldap_settings || {};
  const adUsers = await fetchLdapUsers(settings);
  return await reconcileAndSaveLdapUsers(dbData, saveCollection, adUsers, settings);
};

export const importSelectedLdapUsers = async (dbData, saveCollection, selectedUsers, customSettings = null) => {
  const settings = customSettings || dbData.ldap_settings || {};
  return await reconcileAndSaveLdapUsers(dbData, saveCollection, selectedUsers, settings);
};

export const authenticateLdapUser = (loginInput, passwordInput, settings = {}) => {
  return new Promise((resolve) => {
    const cleanLogin = String(loginInput || '').trim();
    const cleanPass = String(passwordInput || '').trim();

    if (!cleanLogin || !cleanPass || !settings || !settings.serverUrl) {
      return resolve(null);
    }

    const domain = settings.domainName || 'enpf.kz';
    const domainPrefix = domain.split('.')[0].toUpperCase();
    const tryUpn = cleanLogin.includes('@') ? cleanLogin : `${cleanLogin}@${domain}`;
    const tryNetBios = cleanLogin.includes('\\') ? cleanLogin : `${domainPrefix}\\${cleanLogin.split('@')[0]}`;

    // Вспомогательная функция прямого bind (Direct Fallback)
    const tryDirectBindFallback = (reason) => {
      console.log(`🔌 [LDAP Auth] Запуск резервной прямой проверки UPN/NetBIOS для "${cleanLogin}" (${reason})...`);
      const directClient = createLdapClient(settings);
      directClient.on('error', () => {});

      // 1. Прямой bind по UPN (user@domain.kz)
      directClient.bind(tryUpn, cleanPass, (errUpn) => {
        if (!errUpn) {
          directClient.unbind();
          console.log(`✅ [LDAP Auth] Успешная прямая авторизация по UPN: ${tryUpn}`);
          return resolve({
            login: cleanLogin.split('@')[0],
            email: tryUpn,
            name: cleanLogin.split('@')[0],
            department: 'Корпоративный отдел',
            authSource: 'LDAP'
          });
        }

        // 2. Прямой bind по NetBIOS (DOMAIN\user)
        directClient.bind(tryNetBios, cleanPass, (errNetBios) => {
          directClient.unbind();
          if (!errNetBios) {
            console.log(`✅ [LDAP Auth] Успешная прямая авторизация по NetBIOS: ${tryNetBios}`);
            return resolve({
              login: cleanLogin.split('@')[0],
              email: tryUpn,
              name: cleanLogin.split('@')[0],
              department: 'Корпоративный отдел',
              authSource: 'LDAP'
            });
          }

          console.warn(`❌ [LDAP Auth] Прямая проверка отклонена AD для "${cleanLogin}" (Неверный логин или пароль)`);
          resolve(null);
        });
      });
    };

    const serviceBindDn = settings.bindDN || settings.username || '';
    const serviceBindPass = settings.bindPassword || settings.password || '';

    // Если нет сервисной учетки, сразу запускаем прямой bind
    if (!serviceBindDn) {
      return tryDirectBindFallback('Отсутствует сервисный bindDN');
    }

    const client = createLdapClient(settings);
    client.on('error', (err) => {
      console.warn('⚠️ [LDAP Auth] Ошибка клиента при поиске, переход к прямой проверке:', err.message);
      tryDirectBindFallback('Сетевой сбой сокета');
    });

    client.bind(serviceBindDn, serviceBindPass, (bindErr) => {
      if (bindErr) {
        console.warn('⚠️ [LDAP Auth] Ошибка сервисного bind, переход к прямой проверке пользователя:', bindErr.message);
        client.unbind();
        return tryDirectBindFallback('Ошибка сервисной учетки');
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
          return tryDirectBindFallback('Ошибка поискового запроса');
        }

        let userEntry = null;

        res.on('searchEntry', (entry) => {
          if (!userEntry) userEntry = entry;
        });

        res.on('searchReference', () => {
          // Игнорируем рефералы AD
        });

        res.on('error', (err) => {
          if (err && (err.name === 'ReferralError' || err.code === 10 || err.name === 'SizeLimitExceededError' || err.code === 4 || err.name === 'TimeLimitExceededError' || err.code === 3)) {
            if (userEntry) {
              return processUserBind();
            }
          }
          client.unbind();
          tryDirectBindFallback('Таймаут или ограничение поиска');
        });

        res.on('end', () => {
          if (!userEntry) {
            client.unbind();
            return tryDirectBindFallback('Сотрудник не найден поиском в BaseDN');
          }
          processUserBind();
        });

        function processUserBind() {
          const obj = userEntry.object || {};
          const getVal = (attrName) => {
            if (!attrName) return '';
            let val = obj[attrName];
            if (!val && typeof obj === 'object') {
              const foundKey = Object.keys(obj).find(k => k.toLowerCase() === attrName.toLowerCase());
              if (foundKey) val = obj[foundKey];
            }
            if (!val && Array.isArray(userEntry.attributes)) {
              const attr = userEntry.attributes.find(a => (a.type || a.name || '').toLowerCase() === attrName.toLowerCase());
              if (attr && (attr.values || attr.vals)) val = attr.values || attr.vals;
            }
            if (!val) return '';
            return Array.isArray(val) ? String(val[0]).trim() : String(val).trim();
          };

          const userDn = userEntry.dn?.toString() || obj.distinguishedName || obj.distinguishedname || '';
          const userUpn = getVal(loginAttr) || getVal('userPrincipalName') || (getVal('sAMAccountName') ? `${getVal('sAMAccountName')}@${domain}` : tryUpn);
          const email = getVal(emailAttr) || getVal('mail') || getVal('userPrincipalName') || tryUpn;
          const login = getVal('sAMAccountName') || getVal(loginAttr) || cleanLogin.split('@')[0];
          const name = getVal(nameAttr) || getVal('displayName') || getVal('cn') || login;
          const department = getVal(deptAttr) || getVal('department') || 'Корпоративный отдел';

          const userClient = createLdapClient(settings);
          userClient.on('error', () => {});

          // 1. Попытка bind по UPN найденной карточки
          userClient.bind(userUpn, cleanPass, (bindUpnErr) => {
            if (!bindUpnErr) {
              userClient.unbind();
              client.unbind();
              console.log(`✅ [LDAP Auth] Авторизация успешна по карточке AD (UPN: ${userUpn})`);
              return resolve({ dn: userDn, login, email, name, department, authSource: 'LDAP' });
            }

            // 2. Попытка bind по DN найденной карточки
            if (userDn && userDn !== userUpn) {
              userClient.bind(userDn, cleanPass, (bindDnErr) => {
                if (!bindDnErr) {
                  userClient.unbind();
                  client.unbind();
                  console.log(`✅ [LDAP Auth] Авторизация успешна по карточке AD (DN: ${userDn})`);
                  return resolve({ dn: userDn, login, email, name, department, authSource: 'LDAP' });
                }
                userClient.unbind();
                client.unbind();
                // Если по карточке не прошло, запускаем прямой fallback перед отказом!
                tryDirectBindFallback('Ошибки bind под найденным DN/UPN');
              });
            } else {
              userClient.unbind();
              client.unbind();
              tryDirectBindFallback('Ошибка bind под найденным UPN');
            }
          });
        }
      });
    });
  });
};
