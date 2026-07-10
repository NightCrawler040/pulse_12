export const initialUsers = [
  {
    id: 'usr-1',
    name: 'Александр Громов',
    login: 'admin',
    password: 'Pulse12_Secure_2026!',
    role: 'Tech Lead / Admin',
    roleType: 'admin',
    department: 'Engineering',
    email: 'a.gromov@corp.lan',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    pin: '2026',
    isActive: true
  }
];

export const initialSprints = [
  {
    id: 'sprint-1',
    name: 'Sprint 24: Core Pulse 12 Release',
    startDate: '2026-07-01',
    endDate: '2026-07-14',
    goal: 'Внедрение RBAC, оптимизация 60 FPS, централизованный сервер и сетевой доступ для 12 сотрудников',
    isActive: true
  },
  {
    id: 'sprint-2',
    name: 'Sprint 25: Analytics & Integrations',
    startDate: '2026-07-15',
    endDate: '2026-07-28',
    goal: 'Расширенная отчетность по отделам и автоматические уведомления в Telegram/Slack',
    isActive: false
  }
];

export const initialTasks = [
  {
    id: 'NEX-101',
    title: 'Настройка центрального сервера на ноутбуке для команды из 12 человек',
    description: 'Развернуть Node.js + Express + Socket.io сервер на центральном ноутбуке с доступом из локальной сети (LAN). Обеспечить хранение данных в db.json.',
    status: 'done',
    priority: 'urgent',
    assigneeId: 'usr-1',
    storyPoints: 8,
    estimatedHours: 16,
    loggedHours: 16,
    sprintId: 'sprint-1',
    tags: ['Architecture', 'Backend', 'DevOps'],
    createdAt: '2026-07-01T09:00:00Z',
    updatedAt: '2026-07-04T12:00:00Z',
    subtasks: [
      { id: 'sub-1', title: 'Установить express, cors, socket.io', completed: true },
      { id: 'sub-2', title: 'Реализовать синхронизацию db.json', completed: true },
      { id: 'sub-3', title: 'Проверить доступ по IP в локальной сети', completed: true }
    ],
    comments: [
      {
        id: 'c-1',
        userId: 'usr-1',
        text: 'Сервер успешно настроен на порту 3001. Любой ноутбук в Wi-Fi сети подключается мгновенно!',
        createdAt: '2026-07-04T12:15:00Z'
      }
    ]
  },
  {
    id: 'NEX-102',
    title: 'Реализация входа по Логину и Паролю для новых сотрудников',
    description: 'Обеспечить возможность Администратору создавать учетные записи с Логином и Паролем. Перевести модальное окно авторизации на форму ввода учетных данных.',
    status: 'in-progress',
    priority: 'high',
    assigneeId: 'usr-1',
    storyPoints: 5,
    estimatedHours: 12,
    loggedHours: 6,
    sprintId: 'sprint-1',
    tags: ['Security', 'Frontend', 'UI/UX'],
    createdAt: '2026-07-02T10:00:00Z',
    updatedAt: '2026-07-04T14:00:00Z',
    subtasks: [
      { id: 'sub-4', title: 'Обновить интерфейс User (поля login и password)', completed: true },
      { id: 'sub-5', title: 'Обновить AdminPanel для ввода логина и пароля', completed: false },
      { id: 'sub-6', title: 'Обновить LoginModal для аутентификации', completed: false }
    ],
    comments: []
  },
  {
    id: 'NEX-103',
    title: 'Мгновенная синхронизация через WebSockets (Socket.io) на всех ПК',
    description: 'Когда сотрудник перемещает задачу на своем ноутбуке, у всех остальных коллег в офисе доска должна обновляться автоматически без перезагрузки браузера.',
    status: 'in-progress',
    priority: 'urgent',
    assigneeId: 'usr-1',
    storyPoints: 8,
    estimatedHours: 20,
    loggedHours: 10,
    sprintId: 'sprint-1',
    tags: ['Backend', 'Architecture', 'Frontend'],
    createdAt: '2026-07-02T11:30:00Z',
    updatedAt: '2026-07-04T13:45:00Z',
    subtasks: [
      { id: 'sub-7', title: 'Подключить socket.io-client в TaskContext', completed: false },
      { id: 'sub-8', title: 'Обработка события data-updated', completed: false }
    ],
    comments: [
      {
        id: 'c-2',
        userId: 'usr-1',
        text: 'Это ключевая фича для совместных грумингов и планирования спринта!',
        createdAt: '2026-07-03T09:20:00Z'
      }
    ]
  },
  {
    id: 'NEX-104',
    title: 'Переключатель IP-адреса сервера в шапке портала',
    description: 'Добавить кнопку в Header, позволяющую сотрудникам в один клик указать IP-адрес центрального ноутбука в Wi-Fi сети.',
    status: 'todo',
    priority: 'medium',
    assigneeId: 'usr-1',
    storyPoints: 3,
    estimatedHours: 6,
    loggedHours: 0,
    sprintId: 'sprint-1',
    tags: ['Frontend', 'UI/UX'],
    createdAt: '2026-07-03T14:00:00Z',
    updatedAt: '2026-07-03T14:00:00Z',
    subtasks: [],
    comments: []
  },
  {
    id: 'NEX-105',
    title: 'Оптимизация рендеринга доски задач до 60 FPS',
    description: 'Удалить тяжелые backdrop-filter: blur и непрерывные transition: all для мгновенного отклика при перетаскивании карточек на любых ноутбуках.',
    status: 'done',
    priority: 'high',
    assigneeId: 'usr-1',
    storyPoints: 5,
    estimatedHours: 10,
    loggedHours: 10,
    sprintId: 'sprint-1',
    tags: ['Frontend', 'Architecture'],
    createdAt: '2026-07-01T10:00:00Z',
    updatedAt: '2026-07-04T11:00:00Z',
    subtasks: [
      { id: 'sub-9', title: 'Заменить blur на rgba фоны в index.css', completed: true },
      { id: 'sub-10', title: 'Убрать transition: all в KanbanBoard.css', completed: true }
    ],
    comments: []
  },
  {
    id: 'NEX-106',
    title: 'Разработка личного кабинета сотрудника («Моя страница»)',
    description: 'Создать вкладку с персональной статистикой KPI, отработанными часами, Story Points и списком закрепленных задач.',
    status: 'done',
    priority: 'medium',
    assigneeId: 'usr-1',
    storyPoints: 5,
    estimatedHours: 14,
    loggedHours: 14,
    sprintId: 'sprint-1',
    tags: ['UI/UX', 'Frontend'],
    createdAt: '2026-07-02T15:00:00Z',
    updatedAt: '2026-07-04T13:00:00Z',
    subtasks: [],
    comments: []
  },
  {
    id: 'NEX-107',
    title: 'Внедрение ролевой модели разграничения прав (RBAC)',
    description: 'Запретить обычным сотрудникам редактировать параметры чужих задач. Ограничить доступ к админской панели только для роли Admin.',
    status: 'done',
    priority: 'urgent',
    assigneeId: 'usr-1',
    storyPoints: 8,
    estimatedHours: 16,
    loggedHours: 16,
    sprintId: 'sprint-1',
    tags: ['Security', 'Backend', 'Frontend'],
    createdAt: '2026-07-01T12:00:00Z',
    updatedAt: '2026-07-04T13:30:00Z',
    subtasks: [],
    comments: []
  },
  {
    id: 'NEX-108',
    title: 'Подготовка E2E тестов для автоматизированного тестирования задач',
    description: 'Написать сценарии проверки жизненного цикла задачи: создание -> взятие в работу -> проверка -> завершение.',
    status: 'todo',
    priority: 'medium',
    assigneeId: 'usr-1',
    storyPoints: 5,
    estimatedHours: 16,
    loggedHours: 0,
    sprintId: 'sprint-2',
    tags: ['QA', 'Architecture'],
    createdAt: '2026-07-03T16:00:00Z',
    updatedAt: '2026-07-03T16:00:00Z',
    subtasks: [],
    comments: []
  }
];

export const initialGroups = [
  {
    id: 'grp-1',
    name: '🚀 Команда Разработки (Engineering)',
    color: '#3b82f6',
    memberIds: ['usr-1']
  },
  {
    id: 'grp-2',
    name: '🎯 Менеджмент и Продукт (Product & Agile)',
    color: '#8b5cf6',
    memberIds: []
  },
  {
    id: 'grp-3',
    name: '🛡️ Отдел Тестирования (Quality Assurance)',
    color: '#10b981',
    memberIds: []
  },
  {
    id: 'grp-4',
    name: '🎨 Дизайн и UX (Design Team)',
    color: '#ec4899',
    memberIds: []
  }
];
