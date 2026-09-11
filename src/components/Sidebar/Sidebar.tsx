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
  Moon,
  ChevronLeft
} from 'lucide-react';
import './Sidebar.css';

export const Sidebar: React.FC = () => {
  const { viewMode, setViewMode, theme, setTheme, users, findings, workspaces, activeWorkspaceId, setActiveWorkspaceId } = useTaskContext();
  const { currentUser, isAdmin } = useAuth();
  const [isCollapsed, setIsCollapsed] = React.useState(() => {
    const saved = localStorage.getItem('pulse_sidebar_collapsed');
    return saved === 'true';
  });

  const handleToggleCollapse = () => {
    const newValue = !isCollapsed;
    setIsCollapsed(newValue);
    localStorage.setItem('pulse_sidebar_collapsed', String(newValue));
  };
  
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
    <aside className={`sidebar-container ${isCollapsed ? 'collapsed' : ''}`}>
      <button className="collapse-btn" onClick={handleToggleCollapse} title={isCollapsed ? "Развернуть меню" : "Свернуть меню"}>
        <ChevronLeft size={14} />
      </button>

            <div className="sidebar-brand">
        <Activity size={24} className="logo-icon" />
        <span>Pulse</span>
      </div>

      {currentUser && workspaces.length > 0 && activeWorkspaceId && (
        <div style={{ padding: '0 12px 16px 12px', display: isCollapsed ? 'none' : 'block' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'hsl(var(--text-secondary))', marginBottom: '4px', paddingLeft: '4px', fontWeight: 600 }}>Пространство</div>
          <select 
            value={activeWorkspaceId}
            onChange={(e) => setActiveWorkspaceId(e.target.value)}
            style={{ 
              width: '100%', 
              background: 'rgba(255,255,255,0.05)', 
              border: '1px solid rgba(255,255,255,0.1)', 
              color: 'hsl(var(--text-primary))', 
              padding: '6px 8px', 
              borderRadius: '4px',
              fontSize: '0.85rem',
              outline: 'none'
            }}
          >
            {workspaces
              .filter(ws => isAdmin || (currentUser.workspaceIds && currentUser.workspaceIds.includes(ws.id)))
              .map(ws => (
              <option key={ws.id} value={ws.id}>{ws.name}</option>
            ))}
          </select>
        </div>
      )}

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
