import type { User, Column, Sprint, Task } from '../types';

export const mockUsers: User[] = [
  {
    id: 'usr-1',
    name: 'testadmin',
    role: 'Admin',
    department: 'Engineering',
    email: 'admin@corp.lan',
    login: 'admin',
    password: 'admin', // Mock fallback
    avatar: '',
    roleType: 'admin',
    pin: '1234',
    isActive: true
  }
];

export const mockColumns: Column[] = [
  { id: 'todo', title: 'К выполнению', color: '#64748B' },
  { id: 'in-progress', title: 'В работе', color: '#3B82F6' },
  { id: 'review', title: 'На проверке', color: '#A855F7' },
  { id: 'done', title: 'Готово', color: '#10B981' }
];

export const mockSprints: Sprint[] = [];

export const mockTasks: Task[] = [];
