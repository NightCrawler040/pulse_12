const { Client } = require('pg');

const client = new Client({
  user: 'pulse12_admin',
  password: 'Pulse2026SecureDBPass',
  host: '127.0.0.1',
  port: 5432,
  database: 'pulse12'
});

async function addTask() {
  await client.connect();
  const res = await client.query("SELECT data FROM pulse_store WHERE key = 'tasks'");
  let tasks = res.rows.length > 0 ? res.rows[0].data : [];
  
  const newTask = {
    id: `TSK-${Date.now()}`,
    title: "Внедрить Multi-Tenancy (Workspaces) для изоляции департаментов",
    description: `## Архитектура: Multi-Tenancy через AD Onboarding

Нам необходимо реализовать изоляцию рабочих пространств (Workspaces), чтобы разные департаменты могли независимо работать в системе, не пересекаясь данными.

### Визуализация процесса (Onboarding):
\`\`\`mermaid
sequenceDiagram
    actor Admin as Системный Администратор
    actor Boss as Начальник ИТ (AD)
    actor Emp as Сотрудник ИТ (AD)
    participant Pulse as Pulse Server
    participant DB as PostgreSQL (pulse_store)

    Note over Admin, Pulse: Шаг 1. Глобальная инициализация
    Admin->>Pulse: Создать Workspace "IT Dept"
    Admin->>Pulse: Назначить "IT Boss" Владельцем
    Pulse->>DB: Сохранить Workspace
    
    Note over Boss, Pulse: Шаг 2. Авторизация руководителя
    Boss->>Pulse: Логин через AD
    Pulse-->>Boss: Показывает ТОЛЬКО пространство "IT Dept"
    Boss->>Pulse: Настраивает интеграцию DerScanner для IT
    Boss->>Pulse: Устанавливает правило авто-добавления: группа AD "IT_Users"
    
    Note over Emp, DB: Шаг 3. Вход сотрудников
    Emp->>Pulse: Логин через AD
    Pulse->>DB: Проверка правил Workspace
    DB-->>Pulse: Пользователь в группе "IT_Users"
    Pulse-->>Emp: Автоматический доступ в "IT Dept"
\`\`\`

### Требования к реализации (Бэклог):
1. **Модель БД:** Добавить сущность \`Workspace (id, name, ownerId, adGroup)\`.
2. **Задачи и Уязвимости:** Во все объекты \`tasks\` и \`findings\` добавить поле \`workspaceId\`.
3. **RBAC:** Переписать логику проверки прав. Только System Admin видит всё. Все остальные фильтруются по \`workspaceId\`.
4. **Интеграции:** Вынести ключи DerScanner из глобальных настроек в настройки Workspace.
`,
    status: "To Do",
    priority: "High",
    assignee: "admin",
    department: "Engineering",
    createdAt: new Date().toISOString()
  };

  tasks.unshift(newTask);
  
  await client.query("UPDATE pulse_store SET data = $1 WHERE key = 'tasks'", [JSON.stringify(tasks)]);
  console.log("Task added successfully");
  await client.end();
}

addTask().catch(err => { console.error(err); process.exit(1); });
