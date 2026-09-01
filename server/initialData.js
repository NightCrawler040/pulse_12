export const initialUsers = [
  {
    id: 'usr-1',
    name: 'testadmin',
    login: process.env.ADMIN_LOGIN || 'admin',
    // Default password is 'cortis1234'
    password: process.env.ADMIN_PASSWORD_HASH || '$2a$10$jm9p1H3ipWidxF9fxD3BJO4v3Da73u8wQ71jRj9yORHcfBAR/jTiO',
    role: 'Admin',
    roleType: 'admin',
    department: 'Engineering',
    email: 'admin@corp.lan',
    avatar: '',
    // Default PIN is '1234'
    pin: process.env.ADMIN_PIN_HASH || '$2a$10$IYI2V6lvFdmtqOWkBic8be.NEOzmSVQ/XZLOfDvFW6FaneTG1tXDC',
    isActive: true
  }
];

export const initialSprints = [];

export const initialTasks = [];

export const initialGroups = [];

export const initialFindings = [];

export const initialApiKeys = [];
