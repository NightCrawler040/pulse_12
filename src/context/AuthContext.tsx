import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { User, Task } from '../types';
import { useTaskContext } from './TaskContext';
import { getSocket } from '../services/api';

interface AuthContextType {
  currentUser: User | null;
  isLoggedIn: boolean;
  login: (userId: string, pin: string) => { success: boolean; error?: string };
  logout: () => void;
  updateCurrentUserProfile: (updatedData: Partial<User>) => void;
  isAdmin: boolean;
  isManagerOrAdmin: boolean;
  canEditTask: (task: Task) => boolean;
  canDeleteTask: () => boolean;
  canManageSprints: () => boolean;
  canManageUsers: () => boolean;
  sessionExpired: boolean;
  clearSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'korpjira-flowspace-auth-v1';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { users, groups, updateUser } = useTaskContext();
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      return saved || null; // При первом открытии страницы загружается страница без аккаунта
    } catch {
      return null;
    }
  });

  const currentUser = useMemo(() => {
    if (!currentUserId) return null;
    return users.find(u => u.id === currentUserId && u.isActive !== false) || null;
  }, [currentUserId, users]);

  useEffect(() => {
    if (currentUserId) {
      localStorage.setItem(AUTH_STORAGE_KEY, currentUserId);
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (currentUser) {
      try {
        const socket = getSocket();
        socket.emit('user-online', currentUser.id);
      } catch (err) {
        console.error('Socket emit error:', err);
      }
    }
  }, [currentUser]);

  const [sessionExpired, setSessionExpired] = useState(false);

  // 🕒 15-Minute Session Inactivity Timeout
  useEffect(() => {
    if (!currentUser) return;

    const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 минут
    let timeoutId: ReturnType<typeof setTimeout>;

    const handleTimeout = () => {
      console.warn('🕒 Сеанс завершен из-за неактивности в течение 15 минут');
      setCurrentUserId(null);
      setSessionExpired(true);
    };

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(handleTimeout, INACTIVITY_TIMEOUT_MS);
    };

    // Initialize timer
    resetTimer();

    // Throttled activity listener (max once per 2 seconds)
    let lastEventTime = 0;
    const throttledHandler = () => {
      const now = Date.now();
      if (now - lastEventTime > 2000) {
        lastEventTime = now;
        resetTimer();
      }
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(ev => window.addEventListener(ev, throttledHandler, { passive: true }));

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(ev => window.removeEventListener(ev, throttledHandler));
    };
  }, [currentUser]);

  const login = (identifier: string, passOrPin: string) => {
    setSessionExpired(false);
    const user = users.find(u => {
      if (u.isActive === false) return false;
      if (u.id === identifier && (u.pin === passOrPin || u.password === passOrPin)) return true;
      if (u.login && u.login.toLowerCase() === identifier.toLowerCase() && (u.password === passOrPin || u.pin === passOrPin)) return true;
      if (u.email && u.email.toLowerCase() === identifier.toLowerCase() && (u.password === passOrPin || u.pin === passOrPin)) return true;
      if (u.name && u.name.toLowerCase() === identifier.toLowerCase() && (u.password === passOrPin || u.pin === passOrPin)) return true;
      return false;
    });

    if (!user) {
      return { success: false, error: 'Неверный логин (или ID) и пароль' };
    }
    if (user.isActive === false) {
      return { success: false, error: 'Учетная запись заблокирована администратором' };
    }
    setCurrentUserId(user.id);
    return { success: true };
  };

  const logout = () => {
    setCurrentUserId(null);
  };

  const updateCurrentUserProfile = (updatedData: Partial<User>) => {
    if (currentUser) {
      updateUser(currentUser.id, updatedData);
    }
  };

  const isAdmin = currentUser?.roleType === 'admin';
  const isManagerOrAdmin = currentUser?.roleType === 'admin' || currentUser?.roleType === 'manager';

  const canEditTask = (task: Task) => {
    if (!currentUser) return false;
    if (isManagerOrAdmin) return true;
    // Обычный сотрудник может менять статус/описание своих задач, ничейных, или задач своей группы
    if (task.assigneeId === currentUser.id || !task.assigneeId) return true;
    if (task.assigneeGroupId && groups) {
      const group = groups.find(g => g.id === task.assigneeGroupId);
      if (group && group.memberIds.includes(currentUser.id)) return true;
    }
    return false;
  };

  const canDeleteTask = () => {
    return isAdmin;
  };

  const canManageSprints = () => {
    return isManagerOrAdmin;
  };

  const canManageUsers = () => {
    return isAdmin;
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLoggedIn: !!currentUser,
        login,
        logout,
        updateCurrentUserProfile,
        isAdmin,
        isManagerOrAdmin,
        canEditTask,
        canDeleteTask,
        canManageSprints,
        canManageUsers,
        sessionExpired,
        clearSessionExpired: () => setSessionExpired(false)
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
