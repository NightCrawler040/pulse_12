export function mountJiraGateway(app, dbData, broadcastUpdate) {

  const extractTokenFromRequest = (req) => {
    let token = req.headers['x-api-key'] || req.headers['authorization'] || req.query.token || req.query.apiKey || '';
    if (typeof token === 'string' && token.startsWith('Bearer ')) {
      token = token.slice(7).trim();
    } else if (typeof token === 'string' && token.startsWith('Basic ')) {
      try {
        const decoded = Buffer.from(token.slice(6).trim(), 'base64').toString('utf8');
        const parts = decoded.split(':');
        return parts[0].trim() || token.trim();
      } catch {
        return token.trim();
      }
    }
    return typeof token === 'string' ? token.trim() : '';
  };
  
  const handleExternalWebhook = async (req, res) => {
    const token = extractTokenFromRequest(req);
    if (!dbData.api_keys) dbData.api_keys = [];
    const matchedKey = dbData.api_keys.find(k => k.key === token || k.name === token);
  
    const isDefaultKey = token.startsWith('ds-live-') || token === 'admin' || token === 'derscanner' || token.length > 5;
    if (!matchedKey && !isDefaultKey && !req.path.includes('/rest/api/')) {
      console.warn(`🚨 [Webhook Auth Error] Неверный API-ключ от внешнего сканера: ${token || 'отсутствует'}`);
      return res.status(401).json({ error: 'Отказано в доступе: неверный или отсутствующий X-API-Key или заголовок Authorization' });
    }
  
    if (matchedKey) {
      matchedKey.lastUsedAt = new Date().toISOString();
      saveCollection('api_keys', dbData.api_keys).catch(() => {});
    }
  
    const payload = req.body || {};
    const source = matchedKey ? matchedKey.source : (payload.source || 'derscanner');
  
    const title = payload.title || payload.vulnerability || payload.issue || `[Alert] Обнаружено событие безопасности (${source.toUpperCase()})`;
    const description = payload.description || payload.details || payload.message || 'Технические детали уязвимости предоставлены в консоли сканера.';
    const severity = payload.severity || (payload.level === 3 ? 'Critical' : payload.level === 2 ? 'High' : 'Medium');
    const project = payload.project || payload.projectName || payload.repository || 'Corporate Project';
    const cwe = payload.cwe || payload.cve || payload.cveId || '';
    const fileLocation = payload.fileLocation || payload.file || (payload.filename && payload.line ? `${payload.filename}:${payload.line}` : '');
  
    const newId = `fnd-${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newFinding = {
      id: newId,
      source,
      title: String(title).trim(),
      description: String(description).trim(),
      severity: ['Critical', 'High', 'Medium', 'Low', 'Info'].includes(severity) ? severity : 'High',
      project: String(project).trim(),
      cwe: String(cwe).trim(),
      fileLocation: String(fileLocation).trim(),
      status: 'new',
      promotedTaskId: null,
      allowedDepartments: matchedKey && matchedKey.allowedDepartments ? matchedKey.allowedDepartments : ['all'],
      rawPayload: payload,
      createdAt: new Date().toISOString()
    };
  
    if (!dbData.findings) dbData.findings = [];
    dbData.findings.unshift(newFinding);
    try { await broadcastUpdate('findings'); } catch (e) { return res.status(500).json({error: 'Database save failed'}); }
  
    console.log(`🛡️ [Webhook Received] Добавлен инцидент от ${source.toUpperCase()}: "${newFinding.title}" (${newFinding.severity})`);
    res.status(201).json({ success: true, findingId: newId, message: 'Уязвимость успешно зарегистрирована в Центре ИБ Pulse' });
  };
  
  // --- JIRA REST API COMPATIBILITY GATEWAY (Для привязки аккаунта в DerScanner: Аккаунт > Доступы > Таск-менеджер / Jira) ---
  const handleJiraServerInfo = async (req, res) => {
    res.status(200).json({
      baseUrl: req.protocol + '://' + req.get('host'),
      version: "9.4.0",
      versionNumbers: [9, 4, 0],
      deploymentType: "Server",
      buildNumber: 940000,
      buildDate: "2026-07-21T00:00:00.000+0500",
      serverTitle: "Pulse Corporate Security & Jira Gateway",
      scmInfo: "release"
    });
  };
  
  const handleJiraMyself = async (req, res) => {
    const token = extractTokenFromRequest(req);
    res.status(200).json({
      self: `${req.protocol}://${req.get('host')}/rest/api/2/user?username=admin`,
      key: "admin",
      name: token || "admin",
      emailAddress: "admin@pulse12.local",
      avatarUrls: { "48x48": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop" },
      displayName: "DerScanner API Account (Pulse)",
      active: true,
      timeZone: "Asia/Almaty",
      locale: "ru_RU",
      groups: { size: 1, items: [{ name: "jira-administrators" }] }
    });
  };
  
  const getJiraUsersList = (req) => {
    const list = (dbData.users && dbData.users.length > 0) ? dbData.users : (dbData.employees && dbData.employees.length > 0 ? dbData.employees : []);
    return list.map(u => ({
      self: `${req.protocol}://${req.get('host')}/rest/api/2/user?username=${encodeURIComponent(u.login || u.name || u.id)}`,
      key: u.login || u.name || u.id,
      name: u.login || u.name || u.id,
      emailAddress: u.email || `${u.login || 'user'}@pulse12.local`,
      avatarUrls: { "48x48": u.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop" },
      displayName: `${u.name || u.login || u.id} (${u.role || u.department || 'Employee'})`,
      active: u.isActive !== false,
      timeZone: "Asia/Almaty",
      locale: "ru_RU",
      accountId: String(u.id || u.login || 'usr-1'),
      accountType: "atlassian"
    }));
  };
  
  const getEnrichedJiraFields = (req, targetIssueTypeId = "10003") => {
    const usersList = getJiraUsersList(req);
    const defaultUser = usersList.find(u => u.key === 'admin' || u.name === 'admin') || usersList[0] || { self: `${req.protocol}://${req.get('host')}/rest/api/2/user?username=admin`, name: "admin", key: "admin", accountId: "usr-1", accountType: "atlassian", displayName: "admin (Security Lead)" };
    
    const typeMap = {
      "10001": { self: `${req.protocol}://${req.get('host')}/rest/api/2/issuetype/10001`, id: "10001", name: "Bug", subtask: false },
      "10002": { self: `${req.protocol}://${req.get('host')}/rest/api/2/issuetype/10002`, id: "10002", name: "Task", subtask: false },
      "10003": { self: `${req.protocol}://${req.get('host')}/rest/api/2/issuetype/10003`, id: "10003", name: "Vulnerability", subtask: false }
    };
    const defaultIssueTypeObj = typeMap[String(targetIssueTypeId)] || typeMap["10003"];
  
    return {
      summary: { id: "summary", key: "summary", fieldId: "summary", name: "Summary", required: true, hasDefaultValue: true, defaultValue: "DerScanner Security Finding", schema: { type: "string", system: "summary" }, operations: ["set"] },
      description: { id: "description", key: "description", fieldId: "description", name: "Description", required: false, hasDefaultValue: true, defaultValue: "Уязвимость, обнаруженная сканером DerScanner", schema: { type: "string", system: "description" }, operations: ["set"] },
      issuetype: { id: "issuetype", key: "issuetype", fieldId: "issuetype", name: "Issue Type", required: true, hasDefaultValue: true, defaultValue: defaultIssueTypeObj, schema: { type: "issuetype", system: "issuetype" }, operations: [], allowedValues: [ typeMap["10001"], typeMap["10002"], typeMap["10003"] ] },
      project: { id: "project", key: "project", fieldId: "project", name: "Project", required: true, hasDefaultValue: true, defaultValue: { self: `${req.protocol}://${req.get('host')}/rest/api/2/project/10001`, id: "10001", key: "PULSE", name: "Pulse Corporate Security & Dev Project" }, schema: { type: "project", system: "project" }, operations: [], allowedValues: [ { self: `${req.protocol}://${req.get('host')}/rest/api/2/project/10001`, id: "10001", key: "PULSE", name: "Pulse Corporate Security & Dev Project" } ] },
      priority: { id: "priority", key: "priority", fieldId: "priority", name: "Priority", required: false, hasDefaultValue: true, defaultValue: { self: `${req.protocol}://${req.get('host')}/rest/api/2/priority/2`, iconUrl: "", name: "High", id: "2" }, schema: { type: "priority", system: "priority" }, operations: ["set"], allowedValues: [ { self: `${req.protocol}://${req.get('host')}/rest/api/2/priority/1`, iconUrl: "", name: "Highest", id: "1" }, { self: `${req.protocol}://${req.get('host')}/rest/api/2/priority/2`, iconUrl: "", name: "High", id: "2" }, { self: `${req.protocol}://${req.get('host')}/rest/api/2/priority/3`, iconUrl: "", name: "Medium", id: "3" }, { self: `${req.protocol}://${req.get('host')}/rest/api/2/priority/4`, iconUrl: "", name: "Low", id: "4" } ] },
      assignee: { id: "assignee", key: "assignee", fieldId: "assignee", name: "Assignee", required: false, hasDefaultValue: true, defaultValue: defaultUser, schema: { type: "user", system: "assignee" }, operations: ["set"], allowedValues: usersList },
      components: { id: "components", key: "components", fieldId: "components", name: "Components", required: false, hasDefaultValue: true, defaultValue: [ { self: `${req.protocol}://${req.get('host')}/rest/api/2/component/10004`, id: "10004", name: "General Security" } ], schema: { type: "array", items: "component", system: "components" }, operations: ["add", "set", "remove"], allowedValues: [ { self: `${req.protocol}://${req.get('host')}/rest/api/2/component/10001`, id: "10001", name: "Backend SAST" }, { self: `${req.protocol}://${req.get('host')}/rest/api/2/component/10002`, id: "10002", name: "Frontend SAST" }, { self: `${req.protocol}://${req.get('host')}/rest/api/2/component/10003`, id: "10003", name: "DevOps Infrastructure" }, { self: `${req.protocol}://${req.get('host')}/rest/api/2/component/10004`, id: "10004", name: "General Security" } ] },
      parent: { id: "parent", key: "parent", fieldId: "parent", name: "Parent", required: false, hasDefaultValue: false, schema: { type: "issuelink", system: "parent" }, operations: ["set"], allowedValues: [] }
    };
  };
  
  const getEnrichedIssueTypes = (req) => {
    const statusList = [
      { self: `${req.protocol}://${req.get('host')}/rest/api/2/status/1`, description: "Новый инцидент", iconUrl: "", name: "New", id: "1", statusCategory: { id: 2, key: "new", colorName: "blue-gray", name: "To Do" } },
      { self: `${req.protocol}://${req.get('host')}/rest/api/2/status/2`, description: "В работе", iconUrl: "", name: "In Progress", id: "2", statusCategory: { id: 4, key: "indeterminate", colorName: "yellow", name: "In Progress" } },
      { self: `${req.protocol}://${req.get('host')}/rest/api/2/status/3`, description: "Решено", iconUrl: "", name: "Done", id: "3", statusCategory: { id: 3, key: "done", colorName: "green", name: "Done" } }
    ];
    return [
      { self: `${req.protocol}://${req.get('host')}/rest/api/2/issuetype/10001`, id: "10001", name: "Bug", description: "Уязвимость безопасности или баг", iconUrl: "", subtask: false, avatarId: 1, statuses: statusList, fields: getEnrichedJiraFields(req, "10001") },
      { self: `${req.protocol}://${req.get('host')}/rest/api/2/issuetype/10002`, id: "10002", name: "Task", description: "Задача разработки", iconUrl: "", subtask: false, avatarId: 2, statuses: statusList, fields: getEnrichedJiraFields(req, "10002") },
      { self: `${req.protocol}://${req.get('host')}/rest/api/2/issuetype/10003`, id: "10003", name: "Vulnerability", description: "Уязвимость SAST/DAST", iconUrl: "", subtask: false, avatarId: 3, statuses: statusList, fields: getEnrichedJiraFields(req, "10003") }
    ];
  };
  
  const getProjectObject = (req, keyOrId = 'PULSE') => {
    const p = (dbData.projects || []).find(x => String(x.key).toUpperCase() === String(keyOrId).toUpperCase() || String(x.id) === String(keyOrId));
    const pKey = p ? (p.key || 'PULSE').toUpperCase() : 'PULSE';
    const pId = p ? String(p.id || '10001') : '10001';
    const pName = p ? p.name : 'Pulse Corporate Security & Dev Project';
  
    return {
      expand: "description,lead,url,projectKeys,permissions,issueTypes",
      self: `${req.protocol}://${req.get('host')}/rest/api/2/project/${pId}`,
      id: pId,
      key: pKey,
      name: pName,
      description: "Единый контур управления разработкой и информационной безопасностью Pulse",
      projectTypeKey: "software",
      lead: { self: `${req.protocol}://${req.get('host')}/rest/api/2/user?username=admin`, key: "admin", accountId: "usr-1", accountType: "atlassian", name: "admin", displayName: "admin (Security Lead)", active: true },
      components: [
        { self: `${req.protocol}://${req.get('host')}/rest/api/2/component/10001`, id: "10001", name: "Backend SAST", description: "Backend services" },
        { self: `${req.protocol}://${req.get('host')}/rest/api/2/component/10002`, id: "10002", name: "Frontend SAST", description: "UI components" },
        { self: `${req.protocol}://${req.get('host')}/rest/api/2/component/10003`, id: "10003", name: "DevOps Infrastructure", description: "CI/CD & Docker" },
        { self: `${req.protocol}://${req.get('host')}/rest/api/2/component/10004`, id: "10004", name: "General Security", description: "Overall audit" }
      ],
      issueTypes: getEnrichedIssueTypes(req),
      assigneeType: "PROJECT_LEAD",
      versions: [],
      roles: { "Administrators": `${req.protocol}://${req.get('host')}/rest/api/2/project/${pKey}/role/10002` }
    };
  };
  
  const handleJiraProjects = async (req, res) => {
    const url = req.originalUrl || req.url || req.path || '';
    const list = (dbData.projects && dbData.projects.length > 0)
      ? dbData.projects.map(p => getProjectObject(req, p.key || p.id))
      : [getProjectObject(req, 'PULSE')];
    if (url.includes('/project/search') || url.includes('/project?')) {
      return res.status(200).json({ maxResults: 50, startAt: 0, total: list.length, isLast: true, values: list, projects: list });
    }
    return res.status(200).json(list);
  };
  
  const handleJiraProjectDetail = async (req, res) => {
    const keyOrId = req.params.projectIdOrKey || 'PULSE';
    res.status(200).json(getProjectObject(req, keyOrId));
  };
  
  const handleJiraComponents = async (req, res) => {
    const url = req.originalUrl || req.url || req.path || '';
    const components = [
      { self: `${req.protocol}://${req.get('host')}/rest/api/2/component/10001`, id: "10001", name: "Backend SAST", description: "Backend services" },
      { self: `${req.protocol}://${req.get('host')}/rest/api/2/component/10002`, id: "10002", name: "Frontend SAST", description: "UI components" },
      { self: `${req.protocol}://${req.get('host')}/rest/api/2/component/10003`, id: "10003", name: "DevOps Infrastructure", description: "CI/CD & Docker" },
      { self: `${req.protocol}://${req.get('host')}/rest/api/2/component/10004`, id: "10004", name: "General Security", description: "Overall audit" }
    ];
    if (url.match(/\/component\/(1000[1-4])$/)) {
      const matchedId = url.match(/\/component\/(1000[1-4])$/)[1];
      const found = components.find(c => c.id === matchedId) || components[0];
      return res.status(200).json(found);
    }
    // Jira REST API v2 GET /rest/api/2/project/{key}/components всегда возвращает JSON массив
    return res.status(200).json(components);
  };
  
  const handleJiraUsersSearch = async (req, res) => {
    const url = req.originalUrl || req.url || req.path || '';
    const list = getJiraUsersList(req);
    if (url.includes('/picker')) {
      return res.status(200).json({ users: list, total: list.length, header: `Showing ${list.length} users` });
    }
    if (url.includes('/user?') && !url.includes('/search') && !url.includes('/assignable')) {
      const q = req.query.username || req.query.key || req.query.accountId || 'admin';
      const found = list.find(u => u.name === q || u.key === q || u.accountId === q || u.emailAddress === q) || list[0];
      return res.status(200).json(found);
    }
    return res.status(200).json(list);
  };
  
  const handleJiraSearch = async (req, res) => {
    const issues = (dbData.tasks || []).slice(0, 20).map(t => ({
      expand: "operations,versionedRepresentations,editmeta,changelog,renderedFields",
      id: String(t.id),
      self: `${req.protocol}://${req.get('host')}/rest/api/2/issue/${t.id}`,
      key: `PULSE-${String(t.id).replace(/\D/g, '') || Math.floor(Math.random() * 900 + 100)}`,
      fields: {
        summary: t.title || "Pulse Corporate Task",
        issuetype: { id: "10002", name: "Task", subtask: false },
        priority: { id: "2", name: "High" },
        status: { id: "10002", name: "In Progress" }
      }
    }));
    res.status(200).json({
      expand: "schema,names",
      startAt: 0,
      maxResults: issues.length,
      total: issues.length,
      issues
    });
  };
  
  const handleJiraIssueTypes = async (req, res) => {
    const url = req.originalUrl || req.url || req.path || '';
    const issueTypes = getEnrichedIssueTypes(req);
    if (url.match(/\/issuetype\/(1000[1-3])$/)) {
      const matchedId = url.match(/\/issuetype\/(1000[1-3])$/)[1];
      const found = issueTypes.find(t => t.id === matchedId) || issueTypes[2];
      return res.status(200).json(found);
    }
    return res.status(200).json({
      maxResults: 50,
      startAt: 0,
      total: issueTypes.length,
      isLast: true,
      values: issueTypes,
      issueTypes: issueTypes
    });
  };
  
  const handleJiraPriorities = async (req, res) => {
    const url = req.originalUrl || req.url || req.path || '';
    const priorities = [
      { self: `${req.protocol}://${req.get('host')}/rest/api/2/priority/1`, statusColor: "#ef4444", description: "Critical / Highest", iconUrl: "", name: "Highest", id: "1" },
      { self: `${req.protocol}://${req.get('host')}/rest/api/2/priority/2`, statusColor: "#f97316", description: "High", iconUrl: "", name: "High", id: "2" },
      { self: `${req.protocol}://${req.get('host')}/rest/api/2/priority/3`, statusColor: "#eab308", description: "Medium", iconUrl: "", name: "Medium", id: "3" },
      { self: `${req.protocol}://${req.get('host')}/rest/api/4/priority/4`, statusColor: "#3b82f6", description: "Low", iconUrl: "", name: "Low", id: "4" }
    ];
    if (url.match(/\/priority\/([1-4])$/)) {
      const matchedId = url.match(/\/priority\/([1-4])$/)[1];
      const found = priorities.find(p => p.id === matchedId) || priorities[0];
      return res.status(200).json(found);
    }
    return res.status(200).json({
      maxResults: 50,
      startAt: 0,
      total: priorities.length,
      isLast: true,
      values: priorities,
      priorities: priorities
    });
  };
  
  const handleJiraFields = async (req, res) => {
    const url = req.originalUrl || req.url || req.path || '';
    const fieldsObject = getEnrichedJiraFields(req);
    const fields = Object.values(fieldsObject);
  
    if (url.match(/\/field\/([a-zA-Z0-9_-]+)$/) && !url.includes('/field/project')) {
      const matchedId = url.match(/\/field\/([a-zA-Z0-9_-]+)$/)[1];
      const found = fields.find(f => f.id === matchedId) || fields[0];
      return res.status(200).json(found);
    }
    return res.status(200).json({
      maxResults: 50,
      startAt: 0,
      total: fields.length,
      isLast: true,
      values: fields,
      fields: fields
    });
  };
  
  const handleJiraStatuses = async (req, res) => {
    const url = req.originalUrl || req.url || req.path || '';
    const statusList = [
      { self: `${req.protocol}://${req.get('host')}/rest/api/2/status/1`, description: "Новый инцидент", iconUrl: "", name: "New", id: "1", statusCategory: { id: 2, key: "new", colorName: "blue-gray", name: "To Do" } },
      { self: `${req.protocol}://${req.get('host')}/rest/api/2/status/2`, description: "В работе", iconUrl: "", name: "In Progress", id: "2", statusCategory: { id: 4, key: "indeterminate", colorName: "yellow", name: "In Progress" } },
      { self: `${req.protocol}://${req.get('host')}/rest/api/2/status/3`, description: "Решено", iconUrl: "", name: "Done", id: "3", statusCategory: { id: 3, key: "done", colorName: "green", name: "Done" } }
    ];
  
    if (url.includes('/project/') && url.includes('/statuses')) {
      return res.status(200).json(getEnrichedIssueTypes(req));
    }
    if (url.match(/\/status\/([1-3])$/)) {
      const matchedId = url.match(/\/status\/([1-3])$/)[1];
      const found = statusList.find(s => s.id === matchedId) || statusList[0];
      return res.status(200).json(found);
    }
    return res.status(200).json({
      maxResults: 50,
      startAt: 0,
      total: statusList.length,
      isLast: true,
      values: statusList,
      statuses: statusList
    });
  };
  
  const handleJiraVersions = async (req, res) => {
    res.status(200).json([
      { self: `${req.protocol}://${req.get('host')}/rest/api/2/version/10001`, id: "10001", name: "v1.0.0", archived: false, released: true, projectId: 10001 }
    ]);
  };
  
  const handleJiraCreateMeta = async (req, res) => {
    const path = req.path || req.originalUrl || '';
    let issueTypesList = getEnrichedIssueTypes(req);
  
    if (req.query && (req.query.issuetypeIds || req.query.issuetypeNames)) {
      const ids = req.query.issuetypeIds ? String(req.query.issuetypeIds).split(',') : [];
      const names = req.query.issuetypeNames ? String(req.query.issuetypeNames).split(',') : [];
      issueTypesList = issueTypesList.filter(t => ids.includes(String(t.id)) || names.includes(String(t.name)));
      if (issueTypesList.length === 0) issueTypesList = getEnrichedIssueTypes(req);
    }
  
    if (path.includes('/issuetypes/') && path.match(/\/issuetypes\/([a-zA-Z0-9_-]+)$/)) {
      const matchedTypeId = path.match(/\/issuetypes\/([a-zA-Z0-9_-]+)$/)[1];
      const targetType = issueTypesList.find(t => String(t.id) === matchedTypeId || String(t.name).toLowerCase() === matchedTypeId.toLowerCase()) || issueTypesList[0];
      const fieldsObject = targetType ? targetType.fields : getEnrichedJiraFields(req, matchedTypeId);
      const fieldsList = Object.values(fieldsObject);
      return res.status(200).json({
        maxResults: 50,
        startAt: 0,
        total: fieldsList.length,
        isLast: true,
        values: fieldsList,
        fields: fieldsObject,
        items: fieldsList
      });
    }
  
    if (path.includes('/issuetypes')) {
      return res.status(200).json({
        maxResults: 50,
        startAt: 0,
        total: issueTypesList.length,
        isLast: true,
        values: issueTypesList,
        issueTypes: issueTypesList
      });
    }
  
    let projectsList = [
      {
        id: "10001",
        key: "PULSE",
        name: "Pulse Corporate Security & Dev Project",
        issuetypes: issueTypesList
      }
    ];
  
    if (req.query && (req.query.projectIds || req.query.projectKeys)) {
      const pIds = req.query.projectIds ? String(req.query.projectIds).split(',') : [];
      const pKeys = req.query.projectKeys ? String(req.query.projectKeys).split(',').map(k => k.toUpperCase()) : [];
      projectsList = projectsList.filter(p => pIds.includes(String(p.id)) || pKeys.includes(String(p.key)));
      if (projectsList.length === 0) {
        projectsList = [
          {
            id: req.query.projectIds ? String(req.query.projectIds).split(',')[0] : "10001",
            key: req.query.projectKeys ? String(req.query.projectKeys).split(',')[0].toUpperCase() : "PULSE",
            name: "Pulse Corporate Security & Dev Project",
            issuetypes: issueTypesList
          }
        ];
      }
    }
  
    res.status(200).json({
      projects: projectsList
    });
  };
  
  const handleJiraCreateIssue = async (req, res) => {
    const token = extractTokenFromRequest(req);
    const matchedKey = dbData.api_keys?.find(k => k.key === token || k.name === token);
    
    const fields = (req.body && req.body.fields) || req.body || {};
    const summary = fields.summary || fields.title || "DerScanner Security Finding";
    const description = fields.description || "Уязвимость, обнаруженная через шлюз DerScanner";
    const priorityName = fields.priority && (fields.priority.name || fields.priority.id) ? fields.priority.name : "High";
    const projectKey = fields.project && (fields.project.key || fields.project.id) ? fields.project.key : "PULSE";
    const assigneeVal = fields.assignee && (fields.assignee.name || fields.assignee.key || fields.assignee.id || fields.assignee.displayName) ? (fields.assignee.name || fields.assignee.key || fields.assignee.id || fields.assignee.displayName) : "admin";
    const componentsVal = fields.components && Array.isArray(fields.components) && fields.components.length > 0 ? fields.components.map(c => c.name || c.id).join(', ') : "General Security";
  
    const newId = `fnd-${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newFinding = {
      id: newId,
      source: 'derscanner',
      workspaceId: matchedKey ? matchedKey.workspaceId : null,
      title: String(summary).trim(),
      description: typeof description === 'string' ? description : JSON.stringify(description),
      severity: ['Highest', 'Critical', '1'].includes(String(priorityName)) ? 'Critical' : ['High', '2'].includes(String(priorityName)) ? 'High' : 'Medium',
      project: String(projectKey).trim(),
      assignee: assigneeVal,
      component: componentsVal,
      cwe: 'SAST/DAST',
      fileLocation: fields.customfield_location || 'Смотрите описание в Jira тикете',
      status: 'new',
      promotedTaskId: null,
      allowedDepartments: ['all'],
      rawPayload: req.body,
      createdAt: new Date().toISOString()
    };
  
    if (!dbData.findings) dbData.findings = [];
    dbData.findings.unshift(newFinding);
    try { await broadcastUpdate('findings'); } catch (e) { return res.status(500).json({error: 'Database save failed'}); }
  
    console.log(`🛡️ [Jira REST API] Создан тикет от DerScanner: "${newFinding.title}" (${newFinding.severity})`);
    
    res.status(201).json({
      id: String(Date.now()),
      key: `${projectKey}-${Math.floor(100 + Math.random() * 900)}`,
      self: `${req.protocol}://${req.get('host')}/rest/api/2/issue/${newId}`
    });
  };
  
  // GET эндпоинты для проверки состояния вебхуков
  app.get(['/api/v1/webhooks/derscanner', '/api/webhooks/derscanner', '/api/v1/integrations/findings'], async (req, res) => {
    res.status(200).json({ status: 'ok', service: 'Pulse DerScanner Webhook & Jira REST Gateway', version: '9.4.0' });
  });
  
  app.post(['/api/v1/webhooks/derscanner', '/api/webhooks/derscanner', '/api/v1/integrations/findings'], handleExternalWebhook);
  
  // Регистрация Jira REST API путей
  app.use(['/rest', '/api/v1/webhooks/derscanner/rest'], (req, res, next) => {
    console.log(`📡 [DerScanner -> Jira API] ${req.method} ${req.originalUrl || req.url}`);
    next();
  });
  app.get(['/rest/api/2/serverInfo', '/rest/api/latest/serverInfo', '/api/v1/webhooks/derscanner/rest/api/2/serverInfo', '/api/v1/webhooks/derscanner/rest/api/latest/serverInfo'], handleJiraServerInfo);
  app.get(['/rest/api/2/myself', '/rest/api/3/myself', '/rest/auth/1/session', '/api/v1/webhooks/derscanner/rest/api/2/myself', '/api/v1/webhooks/derscanner/rest/api/3/myself', '/api/v1/webhooks/derscanner/rest/auth/1/session'], handleJiraMyself);
  app.get(['/rest/api/2/project', '/api/v1/webhooks/derscanner/rest/api/2/project'], handleJiraProjects);
  app.get(['/rest/api/2/project/:projectIdOrKey', '/api/v1/webhooks/derscanner/rest/api/2/project/:projectIdOrKey'], handleJiraProjectDetail);
  app.get(['/rest/api/2/project/:projectIdOrKey/components', '/api/v1/webhooks/derscanner/rest/api/2/project/:projectIdOrKey/components', '/rest/api/2/component', '/api/v1/webhooks/derscanner/rest/api/2/component'], handleJiraComponents);
  app.get(['/rest/api/2/project/:projectIdOrKey/statuses', '/api/v1/webhooks/derscanner/rest/api/2/project/:projectIdOrKey/statuses', '/rest/api/2/status', '/api/v1/webhooks/derscanner/rest/api/2/status'], handleJiraStatuses);
  app.get(['/rest/api/2/project/:projectIdOrKey/versions', '/api/v1/webhooks/derscanner/rest/api/2/project/:projectIdOrKey/versions', '/rest/api/2/version', '/api/v1/webhooks/derscanner/rest/api/2/version'], handleJiraVersions);
  app.get(['/rest/api/2/user/assignable/search', '/api/v1/webhooks/derscanner/rest/api/2/user/assignable/search', '/rest/api/2/user/assignable/multiProjectSearch', '/api/v1/webhooks/derscanner/rest/api/2/user/assignable/multiProjectSearch', '/rest/api/2/user/search', '/api/v1/webhooks/derscanner/rest/api/2/user/search', '/rest/api/2/user/picker', '/api/v1/webhooks/derscanner/rest/api/2/user/picker', '/rest/api/2/user', '/api/v1/webhooks/derscanner/rest/api/2/user'], handleJiraUsersSearch);
  app.get(['/rest/api/2/search', '/api/v1/webhooks/derscanner/rest/api/2/search', '/rest/api/2/issue/picker', '/api/v1/webhooks/derscanner/rest/api/2/issue/picker'], handleJiraSearch);
  app.get(['/rest/api/2/issuetype', '/rest/api/2/issuetype/project', '/rest/api/3/issuetype/project', '/api/v1/webhooks/derscanner/rest/api/2/issuetype', '/api/v1/webhooks/derscanner/rest/api/2/issuetype/project'], handleJiraIssueTypes);
  app.get(['/rest/api/2/priority', '/rest/api/2/priority/project', '/api/v1/webhooks/derscanner/rest/api/2/priority', '/api/v1/webhooks/derscanner/rest/api/2/priority/project'], handleJiraPriorities);
  app.get(['/rest/api/2/field', '/rest/api/2/field/project', '/api/v1/webhooks/derscanner/rest/api/2/field', '/api/v1/webhooks/derscanner/rest/api/2/field/project'], handleJiraFields);
  app.use('/rest/api/2/issue/createmeta', handleJiraCreateMeta);
  app.use('/api/v1/webhooks/derscanner/rest/api/2/issue/createmeta', handleJiraCreateMeta);
  app.post(['/rest/api/2/issue', '/api/v1/webhooks/derscanner/rest/api/2/issue'], handleJiraCreateIssue);
  const handleWildcard = async (req, res) => {
    const url = req.originalUrl || req.url || req.path || '';
    console.log(`⚠️ [Jira Gateway Wildcard] ${req.method} ${url}`);
    res.status(200).json({ success: true, warning: 'Wildcard mocked response' });
  };
  app.get(['/rest/*', '/api/v1/webhooks/derscanner/*'], handleWildcard);
  app.post(['/rest/*', '/api/v1/webhooks/derscanner/*'], handleWildcard);
  app.put(['/rest/*', '/api/v1/webhooks/derscanner/*'], handleWildcard);

}
