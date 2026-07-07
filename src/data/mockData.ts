import type { User, Column, Sprint, Task } from '../types';

export const mockUsers: User[] = [
  {
    id: 'usr-1',
    name: 'Александр Громов',
    role: 'Tech Lead / Architect',
    department: 'Engineering',
    email: 'a.gromov@corp.lan',
    login: 'admin',
    password: 'admin',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    roleType: 'admin',
    pin: 'admin',
    isActive: true
  }
];

export const mockColumns: Column[] = [
  { id: 'todo', title: 'К выполнению', color: '#64748B' },
  { id: 'in-progress', title: 'В работе', color: '#3B82F6' },
  { id: 'review', title: 'На проверке', color: '#A855F7' },
  { id: 'done', title: 'Готово', color: '#10B981' }
];

export const mockSprints: Sprint[] = [
  {
    id: 'sprint-1',
    name: 'Спринт 14: Релиз нового корпоративного портала',
    startDate: '2026-07-01',
    endDate: '2026-07-14',
    goal: 'Завершить редизайн дашборда и настроить OAuth интеграцию с корпоративным SSO',
    isActive: true
  },
  {
    id: 'sprint-2',
    name: 'Спринт 15: Оптимизация и микросервисы',
    startDate: '2026-07-15',
    endDate: '2026-07-28',
    goal: 'Перевести модуль отчетности на асинхронную очередь сообщений',
    isActive: false
  }
];

export const mockTasks: Task[] = [
  {
    id: 'NEX-101',
    title: 'Интеграция корпоративного SSO (Active Directory / OAuth2)',
    description: 'Необходимо настроить единую точку входа для всех сотрудников корпорации через Active Directory. Реализовать генерацию JWT токена и валидацию ролей.\n\n**Требования:**\n- Поддержка OAuth2 и OpenID Connect\n- Автоматическое создание сессии\n- Логирование успешных и неуспешных попыток входа',
    status: 'in-progress',
    priority: 'urgent',
    assigneeId: 'usr-5',
    storyPoints: 8,
    estimatedHours: 24,
    loggedHours: 14,
    sprintId: 'sprint-1',
    tags: ['Security', 'Backend', 'SSO'],
    subtasks: [
      { id: 'sub-1', title: 'Настроить OAuth2 провайдер на тестовом стенде', completed: true },
      { id: 'sub-2', title: 'Реализовать middleware для проверки JWT в API', completed: true },
      { id: 'sub-3', title: 'Провести юнит- и интеграционное тестирование', completed: false }
    ],
    comments: [
      {
        id: 'com-1',
        userId: 'usr-1',
        text: 'Максим, обрати внимание на таймауты сессии AD, в прошлый раз были обрывы.',
        createdAt: '2026-07-03T10:15:00Z'
      },
      {
        id: 'com-2',
        userId: 'usr-5',
        text: 'Принял, настроил рефреш-токены с временем жизни 24 часа.',
        createdAt: '2026-07-03T11:20:00Z'
      }
    ],
    createdAt: '2026-07-01T09:00:00Z',
    updatedAt: '2026-07-03T11:20:00Z'
  },
  {
    id: 'NEX-102',
    title: 'Редизайн главной страницы аналитического дашборда',
    description: 'Разработать новый современный интерфейс с темной темой, эффектами стекла (glassmorphism) и виджетами загрузки команды в реальном времени.',
    status: 'in-progress',
    priority: 'high',
    assigneeId: 'usr-4',
    storyPoints: 5,
    estimatedHours: 16,
    loggedHours: 10,
    sprintId: 'sprint-1',
    tags: ['UI/UX', 'Design', 'Figma'],
    subtasks: [
      { id: 'sub-4', title: 'Создать интерактивный прототип в Figma', completed: true },
      { id: 'sub-5', title: 'Согласовать дизайн-систему с фронтенд-командой', completed: true },
      { id: 'sub-6', title: 'Подготовить иконки и SVG-ассеты', completed: false }
    ],
    comments: [],
    createdAt: '2026-07-01T10:00:00Z',
    updatedAt: '2026-07-03T14:00:00Z'
  },
  {
    id: 'NEX-103',
    title: 'Верстка компонентов Kanban-доски с Drag-and-Drop',
    description: 'Реализовать отзывчивую сетку колонок с плавными анимациями переноса задач. Обеспечить подсветку целевой зоны при перетаскивании.',
    status: 'review',
    priority: 'high',
    assigneeId: 'usr-3',
    storyPoints: 8,
    estimatedHours: 20,
    loggedHours: 18,
    sprintId: 'sprint-1',
    tags: ['Frontend', 'React', 'Dnd'],
    subtasks: [
      { id: 'sub-7', title: 'Установить и настроить Drag-and-Drop библиотеку', completed: true },
      { id: 'sub-8', title: 'Реализовать компонент TaskCard с индикаторами статуса', completed: true },
      { id: 'sub-9', title: 'Добавить эффект конфетти при переносе в колонку Готово', completed: true }
    ],
    comments: [
      {
        id: 'com-3',
        userId: 'usr-6',
        text: 'На мобильных устройствах тач-свайп работает отлично, проверяю в Safari.',
        createdAt: '2026-07-04T09:30:00Z'
      }
    ],
    createdAt: '2026-07-01T11:00:00Z',
    updatedAt: '2026-07-04T09:30:00Z'
  },
  {
    id: 'NEX-104',
    title: 'Настройка CI/CD пайплайна и Docker-контейнеризации',
    description: 'Оптимизировать скорость сборки Docker-образов для фронтенда и бэкенда. Настроить автоматический деплой в staging-среду при мерже в ветку develop.',
    status: 'todo',
    priority: 'medium',
    assigneeId: 'usr-7',
    storyPoints: 5,
    estimatedHours: 12,
    loggedHours: 0,
    sprintId: 'sprint-1',
    tags: ['DevOps', 'Docker', 'CI/CD'],
    subtasks: [
      { id: 'sub-10', title: 'Написать многоэтапный Dockerfile для Vite сборки', completed: false },
      { id: 'sub-11', title: 'Настроить кэширование node_modules в GitHub Actions', completed: false }
    ],
    comments: [],
    createdAt: '2026-07-02T08:00:00Z',
    updatedAt: '2026-07-02T08:00:00Z'
  },
  {
    id: 'NEX-105',
    title: 'Автоматизированное E2E тестирование ключевых сценариев',
    description: 'Написать Playwright/Cypress тесты для проверки процесса создания задачи, фильтрации по сотрудникам и изменения статуса спринта.',
    status: 'todo',
    priority: 'medium',
    assigneeId: 'usr-6',
    storyPoints: 5,
    estimatedHours: 16,
    loggedHours: 0,
    sprintId: 'sprint-1',
    tags: ['QA', 'Testing', 'Automation'],
    subtasks: [
      { id: 'sub-12', title: 'Подготовительные моки для API', completed: false },
      { id: 'sub-13', title: 'Сценарий создания задачи с прикреплением тегов', completed: false }
    ],
    comments: [],
    createdAt: '2026-07-02T10:00:00Z',
    updatedAt: '2026-07-02T10:00:00Z'
  },
  {
    id: 'NEX-106',
    title: 'Оптимизация SQL-запросов генерации отчетов по загрузке',
    description: 'Устранить N+1 проблему при выборке задач сотрудников за квартал. Уменьшить время формирования аналитического отчета со 4.5с до <300мс.',
    status: 'done',
    priority: 'high',
    assigneeId: 'usr-8',
    storyPoints: 5,
    estimatedHours: 14,
    loggedHours: 12,
    sprintId: 'sprint-1',
    tags: ['Backend', 'Database', 'Performance'],
    subtasks: [
      { id: 'sub-14', title: 'Добавить индексы для полей assigneeId и status', completed: true },
      { id: 'sub-15', title: 'Переписать ORM запрос на сырой SQL с JOIN', completed: true }
    ],
    comments: [],
    createdAt: '2026-07-01T08:30:00Z',
    updatedAt: '2026-07-03T16:45:00Z'
  },
  {
    id: 'NEX-107',
    title: 'Разработка компонента фильтрации и глобального поиска',
    description: 'Реализовать быстрый поиск задач по названию, тегу и исполнителям. Добавить панель с аватарками 12 сотрудников для мгновенной фильтрации в 1 клик.',
    status: 'in-progress',
    priority: 'medium',
    assigneeId: 'usr-9',
    storyPoints: 3,
    estimatedHours: 10,
    loggedHours: 6,
    sprintId: 'sprint-1',
    tags: ['Frontend', 'Search', 'UI'],
    subtasks: [
      { id: 'sub-16', title: 'Вставить дебаунс (debounce) на поле ввода поиска', completed: true },
      { id: 'sub-17', title: 'Интегрировать фильтр в TaskContext', completed: true }
    ],
    comments: [],
    createdAt: '2026-07-02T11:00:00Z',
    updatedAt: '2026-07-04T10:00:00Z'
  },
  {
    id: 'NEX-108',
    title: 'Исследование пользовательского опыта мобильной версии',
    description: 'Провести юзабилити-тестирование текущего интерфейса на смартфонах и планшетах среди сотрудников компании. Составить список улучшений.',
    status: 'review',
    priority: 'low',
    assigneeId: 'usr-10',
    storyPoints: 3,
    estimatedHours: 8,
    loggedHours: 7,
    sprintId: 'sprint-1',
    tags: ['UX', 'Research', 'Mobile'],
    subtasks: [
      { id: 'sub-18', title: 'Опросить 5 специалистов из разных отделов', completed: true },
      { id: 'sub-19', title: 'Сформировать отчет с тепловой картой кликов', completed: true }
    ],
    comments: [],
    createdAt: '2026-07-02T13:00:00Z',
    updatedAt: '2026-07-04T11:00:00Z'
  },
  {
    id: 'NEX-109',
    title: 'Построение ETL-пайплайна для выгрузки метрик спринта',
    description: 'Настроить ежедневный экспорт статистики выполненных Story Points в корпоративную систему бизнес-аналитики (BI).',
    status: 'todo',
    priority: 'medium',
    assigneeId: 'usr-11',
    storyPoints: 5,
    estimatedHours: 15,
    loggedHours: 0,
    sprintId: 'sprint-2',
    tags: ['Analytics', 'Data', 'Python'],
    subtasks: [
      { id: 'sub-20', title: 'Подготовить скрипт экстракции данных из БД', completed: false }
    ],
    comments: [],
    createdAt: '2026-07-03T09:00:00Z',
    updatedAt: '2026-07-03T09:00:00Z'
  },
  {
    id: 'NEX-110',
    title: 'Регрессионное тестирование перед релизом Спринта 14',
    description: 'Полный прогон ручных и авто-тестов на staging сервере. Проверка безопасности и устойчивости к высоким нагрузкам.',
    status: 'todo',
    priority: 'urgent',
    assigneeId: 'usr-12',
    storyPoints: 5,
    estimatedHours: 16,
    loggedHours: 0,
    sprintId: 'sprint-1',
    tags: ['QA', 'Release', 'Security'],
    subtasks: [
      { id: 'sub-21', title: 'Проверить авторизацию под всеми 12 ролями', completed: false },
      { id: 'sub-22', title: 'Нагрузочное тестирование доски при 500+ задачах', completed: false }
    ],
    comments: [],
    createdAt: '2026-07-03T14:00:00Z',
    updatedAt: '2026-07-03T14:00:00Z'
  },
  {
    id: 'NEX-111',
    title: 'Архитектурное ревью микросервиса уведомлений',
    description: 'Провести аудит текущей реализации WebSockets для отправки push-уведомлений о новых комментариях и изменении статуса задач.',
    status: 'done',
    priority: 'high',
    assigneeId: 'usr-1',
    storyPoints: 5,
    estimatedHours: 10,
    loggedHours: 10,
    sprintId: 'sprint-1',
    tags: ['Architecture', 'WebSockets', 'Lead'],
    subtasks: [
      { id: 'sub-23', title: 'Составить схему потоков сообщений в Redis Pub/Sub', completed: true }
    ],
    comments: [],
    createdAt: '2026-07-01T08:00:00Z',
    updatedAt: '2026-07-02T18:00:00Z'
  },
  {
    id: 'NEX-112',
    title: 'Формирование бэклога на Спринт 15 с Product Owner',
    description: 'Оценить входящие запросы от бизнес-заказчиков, расставить приоритеты и предварительные Story Points вместе с командой разработчиков.',
    status: 'in-progress',
    priority: 'high',
    assigneeId: 'usr-2',
    storyPoints: 3,
    estimatedHours: 12,
    loggedHours: 8,
    sprintId: 'sprint-2',
    tags: ['Product', 'Agile', 'Planning'],
    subtasks: [
      { id: 'sub-24', title: 'Провести груминг бэклога с техлидом', completed: true },
      { id: 'sub-25', title: 'Зафиксировать цели спринта 15', completed: false }
    ],
    comments: [],
    createdAt: '2026-07-03T11:00:00Z',
    updatedAt: '2026-07-04T10:00:00Z'
  }
];
