import { io, Socket } from 'socket.io-client';
import type { Task, Sprint, User, Group, NotificationItem } from '../types';

const SERVER_URL_KEY = 'PULSE12_SERVER_URL';

export const getServerUrl = (): string => {
  // 1. В production-режиме (Любой порт кроме Vite dev 5173 / 3000) ВСЕГДА строго используем текущий origin
  if (window.location.port !== '5173' && window.location.port !== '3000') {
    return window.location.origin;
  }

  // 2. В режиме разработки проверяем сохраненный URL в localStorage
  const saved = localStorage.getItem(SERVER_URL_KEY);
  if (saved) return saved;
  
  const host = window.location.hostname || 'localhost';
  return `http://${host}:3001`;
};

export const setServerUrl = (url: string): void => {
  let cleaned = url.trim().replace(/\/$/, '');
  if (cleaned && !cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    cleaned = `${protocol}//${cleaned}`;
  }
  localStorage.setItem(SERVER_URL_KEY, cleaned);
  reconnectSocket();
  window.dispatchEvent(new Event('socket-url-changed'));
};

let socketInstance: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socketInstance) {
    const url = getServerUrl();
    console.log(`🔌 Connecting to Pulse 12 Socket.io server at: ${url}`);
    socketInstance = io(url, {
      reconnectionDelayMax: 2000,
      timeout: 5000
    });
  }
  return socketInstance;
};

export const reconnectSocket = (): Socket => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
  return getSocket();
};

// --- REST API HELPER ---
async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const baseUrl = getServerUrl();
  const url = `${baseUrl}${endpoint}`;
  const authUserId = localStorage.getItem('korpjira-flowspace-auth-v1') || '';
  const authToken = localStorage.getItem('korpjira-auth-token') || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> || {}),
  };
  if (authUserId) headers['x-auth-user'] = authUserId;
  if (authToken) {
    headers['x-api-token'] = authToken;
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP Error ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error(`❌ API Request Failed [${endpoint}]:`, err);
    throw err;
  }
}

export interface DatabaseData {
  tasks: Task[];
  sprints: Sprint[];
  users: User[];
  groups?: Group[];
  notifications?: NotificationItem[];
}

export const apiService = {
  getServerUrl,
  setServerUrl,
  fetchData: () => apiRequest<DatabaseData>('/api/data'),
  clearNotifications: (userId?: string, id?: string) =>
    apiRequest<{ success: boolean }>('/api/notifications' + (id ? `?id=${id}` : (userId ? `?userId=${userId}` : '')), { method: 'DELETE' }),
  markNotificationsRead: (id?: string, userId?: string) =>
    apiRequest<{ success: boolean }>('/api/notifications/read', { method: 'PUT', body: JSON.stringify({ id, userId }) }),
  login: (credentials: { login?: string; password?: string; pin?: string; userId?: string }) => 
    apiRequest<{ success: boolean; user?: User; error?: string }>('/api/login', { method: 'POST', body: JSON.stringify(credentials) }),
  
  createTask: (task: any) => 
    apiRequest<Task>('/api/tasks', { method: 'POST', body: JSON.stringify(task) }),
    
  updateTask: (id: string, updates: Partial<Task>) => 
    apiRequest<{ success: boolean }>(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
    
  deleteTask: (id: string) => 
    apiRequest<{ success: boolean }>(`/api/tasks/${id}`, { method: 'DELETE' }),
    
  createUser: (user: Omit<User, 'id'>) => 
    apiRequest<User>('/api/users', { method: 'POST', body: JSON.stringify(user) }),
    
  updateUser: (id: string, updates: Partial<User>) => 
    apiRequest<{ success: boolean }>(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
    
  deleteUser: (id: string, permanent: boolean = false) => 
    apiRequest<{ success: boolean }>(`/api/users/${id}${permanent ? '?permanent=true' : ''}`, { method: 'DELETE' }),
    
  createGroup: (group: Omit<Group, 'id'>) => 
    apiRequest<Group>('/api/groups', { method: 'POST', body: JSON.stringify(group) }),
    
  updateGroup: (id: string, updates: Partial<Group>) => 
    apiRequest<{ success: boolean }>(`/api/groups/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
    
  deleteGroup: (id: string) => 
    apiRequest<{ success: boolean }>(`/api/groups/${id}`, { method: 'DELETE' }),
    
  createSprint: (sprint: any) => 
    apiRequest<Sprint>('/api/sprints', { method: 'POST', body: JSON.stringify(sprint) }),
    
  updateSprint: (id: string, updates: Partial<Sprint>) => 
    apiRequest<{ success: boolean }>(`/api/sprints/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
    
  deleteSprint: (id: string) => 
    apiRequest<{ success: boolean }>(`/api/sprints/${id}`, { method: 'DELETE' }),
    
  uploadAvatar: async (fileBase64: string, filename: string): Promise<{ success: boolean; url: string }> => {
    const res = await apiRequest<{ success: boolean; url: string }>('/api/upload', {
      method: 'POST',
      body: JSON.stringify({ filename, base64: fileBase64 })
    });
    const baseUrl = getServerUrl();
    return { success: res.success, url: `${baseUrl}${res.url}` };
  },
    
  uploadFile: async (filename: string, fileBase64: string): Promise<{ success: boolean; url: string; size?: number }> => {
    const res = await apiRequest<{ success: boolean; url: string; size?: number }>('/api/upload-file', {
      method: 'POST',
      body: JSON.stringify({ filename, base64: fileBase64 })
    });
    const baseUrl = getServerUrl();
    return { success: res.success, url: `${baseUrl}${res.url}`, size: res.size };
  },
    
  resetDatabase: () => 
    apiRequest<{ success: boolean }>('/api/reset', { method: 'POST' }),
    
  importDatabase: (data: DatabaseData) => 
    apiRequest<{ success: boolean }>('/api/import', { method: 'POST', body: JSON.stringify(data) }),
    
  loginUser: (login?: string, password?: string, pin?: string, userId?: string) => 
    apiRequest<{ success: boolean; user: User }>('/api/login', { 
      method: 'POST', 
      body: JSON.stringify({ login, password, pin, userId }) 
    })
};
