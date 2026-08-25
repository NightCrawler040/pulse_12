import React from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import type { ViewMode } from '../../types';
import { 
  LayoutDashboard, 
  ListTodo, 
  Users, 
  BarChart3, 
  Settings,
  User as UserIcon,
  HelpCircle,
  ShieldAlert,
  Activity,
  Sun,
  Moon
} from 'lucide-react';
import './Sidebar.css';

export const Sidebar: React.FC = () => {
  const { viewMode, setViewMode, theme, setTheme, users, findings } = useTaskContext();
  const { currentUser, isAdmin } = useAuth();
  
  const employeeUsersCount = users.filter(u => u.id !== 'usr-1' && u.login?.toLowerCase() !== 'admin').length;
  const activeFindingsCount = findings.filter(f => f.status === 'new' || f.status === 'analyzing').length;

  const navItems: { mode: ViewMode; label: string; icon: React.ReactNode; badge?: string }[] = [
    { mode: 'board', label: 'Доска', icon: <LayoutDashboard size={18} /> },
    { mode: 'backlog', label: 'Бэклог', icon: <ListTodo size={18} /> },
    { mode: 'workload', label: 'Команда', icon: <Users size={18} />, badge: String(employeeUsersCount) },
    { mode: 'analytics', label: 'Аналитика', icon: <BarChart3 size={18} /> },
    { 
      mode: 'security', 
      label: 'Безопасность', 
      icon: <ShieldAlert size={18} style={{ color: activeFindingsCount > 0 ? '#ef4444' : 'inherit' }} />, 
      badge: activeFindingsCount > 0 ? String(activeFindingsCount) : undefined 
    },
    { mode: 'profile', label: 'Профиль', icon: <UserIcon size={18} /> },
    { mode: 'help', label: 'Помощь', icon: <HelpCircle size={18} /> },
  ];

  if (isAdmin) {
    navItems.push({ mode: 'admin', label: 'Админ', icon: <Settings size={18} /> });
  }

  return (
    <aside className="sidebar-container">
      <div className="sidebar-brand">
        <Activity size={24} className="logo-icon" />
        <span>Pulse</span>
      </div>

      {currentUser && (
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.mode}
              className={`sidebar-nav-item ${viewMode === item.mode ? 'active' : ''}`}
              onClick={() => setViewMode(item.mode)}
            >
              {item.icon}
              <span className="nav-label">{item.label}</span>
              {item.badge && <span className="nav-badge">{item.badge}</span>}
            </button>
          ))}
        </nav>
      )}

      <div className="sidebar-bottom">
        <button 
          className="sidebar-nav-item theme-toggle"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          <span className="nav-label">{theme === 'dark' ? 'Светлая тема' : 'Темная тема'}</span>
        </button>
      </div>
    </aside>
  );
};
