import React, { useState, useRef } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import type { ViewMode } from '../../types';
import { 
  LayoutDashboard, 
  ListTodo, 
  Users, 
  BarChart3, 
  Search, 
  Plus, 
  Sun, 
  Moon, 
  Download, 
  Upload, 
  RotateCcw, 
  Filter, 
  X,
  Sparkles,
  User as UserIcon,
  Settings,
  Key,
  ChevronUp,
  ChevronDown,
  Bell,
  HelpCircle
} from 'lucide-react';
import { NotificationPopover } from '../Notifications/NotificationPopover';
import './Header.css';

interface HeaderProps {
  onOpenNewTaskModal: () => void;
  onOpenLoginModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenNewTaskModal, onOpenLoginModal }) => {
  const { 
    viewMode, 
    setViewMode, 
    theme, 
    setTheme, 
    users, 
    filters, 
    setFilters, 
    resetToDefault, 
    exportData, 
    importData,
    sprints,
    activeSprintId,
    setActiveSprintId,
    isServerConnected,
    onlineUserIds,
    setIsNetworkModalOpen,
    notifications
  } = useTaskContext();

  const { currentUser, isAdmin } = useAuth();

  const [showFilters, setShowFilters] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifBtnRef = useRef<HTMLButtonElement>(null);
  const [isCompact, setIsCompact] = useState<boolean>(() => localStorage.getItem('pulse12_header_compact') === 'true');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const unreadCount = notifications.filter(n => {
    if (n.read || !currentUser) return false;
    if (n.userId === currentUser.id) return true;
    if (n.userId === 'all' && n.type !== 'task_assigned' && n.type !== 'status_changed' && n.type !== 'comment_added') return true;
    return false;
  }).length;

  const toggleCompact = () => {
    const next = !isCompact;
    setIsCompact(next);
    localStorage.setItem('pulse12_header_compact', String(next));
  };

  const handleServerUrlChange = () => {
    setIsNetworkModalOpen(true);
  };

  const handleAvatarClick = (userId: string) => {
    setFilters(prev => ({
      ...prev,
      assigneeId: prev.assigneeId === userId ? null : userId
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          const success = importData(content);
          if (success) {
            alert('Данные успешно импортированы!');
          } else {
            alert('Ошибка импорта: неверный формат файла JSON.');
          }
        }
      };
      reader.readAsText(file);
    }
  };

  const navItems: { mode: ViewMode; label: string; icon: React.ReactNode; badge?: string }[] = [
    { mode: 'board', label: 'Канбан-доска', icon: <LayoutDashboard size={18} /> },
    { mode: 'backlog', label: 'Бэклог & Спринты', icon: <ListTodo size={18} /> },
    { mode: 'workload', label: 'Команда', icon: <Users size={18} />, badge: `${users.length} чел` },
    { mode: 'analytics', label: 'Аналитика', icon: <BarChart3 size={18} /> },
    { mode: 'profile', label: 'Моя страница', icon: <UserIcon size={18} /> },
    { mode: 'help', label: 'Справка ❓', icon: <HelpCircle size={18} /> },
  ];

  if (isAdmin) {
    navItems.push({ mode: 'admin', label: 'Админ-панель ⚙️', icon: <Settings size={18} /> });
  }

  const activeSprint = sprints.find(s => s.id === activeSprintId);

  return (
    <header className={`header-container glass-panel ${isCompact ? 'compact' : ''}`}>
      {/* Top row: Brand, View Tabs, Actions */}
      <div className="header-top">
        <div className="brand-section">
          <div className="brand-logo">
            <Sparkles className="logo-icon" size={24} />
            <span className="logo-text">Pulse<span className="logo-highlight">12</span></span>
          </div>
          <span className="brand-subtitle">Corporate Task Tracker</span>
        </div>

        {/* View Switcher Tabs */}
        {currentUser && (
          <nav className="view-switcher">
            {navItems.map((item) => (
              <button
                key={item.mode}
                className={`nav-tab ${viewMode === item.mode ? 'active' : ''}`}
                onClick={() => setViewMode(item.mode)}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge && <span className="tab-badge">{item.badge}</span>}
              </button>
            ))}
          </nav>
        )}

        {/* Global actions: Server Status, New Task, Theme, Backup */}
        <div className="header-actions">
          {/* LAN Server Connection Pill */}
          <button
            className="btn-secondary"
            onClick={handleServerUrlChange}
            title="Нажмите для настройки IP-адреса сервера для других сотрудников в офисе"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '20px',
              border: '1px solid var(--border-color)',
              background: isServerConnected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: isServerConnected ? '#4ade80' : '#f87171',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: isServerConnected ? '#22c55e' : '#ef4444', display: 'inline-block' }} />
            {isServerConnected ? `🟢 LAN (Онлайн: ${onlineUserIds.length || 1} из ${users.length})` : '⚠️ Офлайн'}
          </button>

          {/* User profile button / Switch user */}
          <button
            className="btn-secondary"
            onClick={() => currentUser ? setViewMode('profile') : onOpenLoginModal()}
            style={{ padding: '6px 12px', gap: '8px', border: '1px solid var(--border-color-focus)' }}
            title={currentUser ? "Личный кабинет (Моя страница)" : "Войти в систему"}
          >
            {currentUser ? (
              <>
                <img src={currentUser.avatar} alt={currentUser.name} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{currentUser.name.split(' ')[0]}</span>
              </>
            ) : (
              <>
                <Key size={16} style={{ color: 'hsl(var(--primary))' }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Войти</span>
              </>
            )}
          </button>

          {currentUser && (
            <button
              className="btn-secondary"
              onClick={() => setFilters(prev => ({ ...prev, myTasksOnly: !prev.myTasksOnly }))}
              title="Фильтр: показывать только ваши задачи и задачи, где вы участвуете (назначены, в рабочей группе или комментировали)"
              style={{
                background: filters.myTasksOnly ? 'hsl(var(--primary))' : 'rgba(255,255,255,0.05)',
                color: filters.myTasksOnly ? '#fff' : 'inherit',
                borderColor: filters.myTasksOnly ? 'hsl(var(--primary))' : 'rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <span>{filters.myTasksOnly ? '👤 Мои задачи и участие' : '👥 Все задачи компании'}</span>
            </button>
          )}

          {currentUser && (
            <button 
              className="btn-primary create-task-btn"
              onClick={onOpenNewTaskModal}
            >
              <Plus size={18} />
              <span>Создать задачу</span>
            </button>
          )}

          {currentUser && (
            <button
              className="icon-btn"
              onClick={toggleCompact}
              title={isCompact ? "Развернуть шапку (Показать спринты, фильтры и цель спринта)" : "Свернуть шапку (Компактный режим для максимального рабочего пространства)"}
              style={{ 
                color: isCompact ? 'hsl(var(--primary))' : undefined,
                background: isCompact ? 'rgba(99, 102, 241, 0.15)' : undefined,
                borderColor: isCompact ? 'hsl(var(--primary))' : undefined
              }}
            >
              {isCompact ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </button>
          )}

          {/* Notification Bell */}
          {currentUser && (
            <div style={{ position: 'relative' }}>
              <button
                ref={notifBtnRef}
                className="icon-btn"
                onClick={() => setIsNotifOpen(prev => !prev)}
                title="Уведомления и события в офисе"
                style={{ position: 'relative' }}
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="notif-badge-pill">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </button>
              <NotificationPopover
                isOpen={isNotifOpen}
                onClose={() => setIsNotifOpen(false)}
                anchorRef={notifBtnRef}
              />
            </div>
          )}

          <button 
            className="icon-btn theme-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? 'Включить светлую тему' : 'Включить темную тему'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Backup menu buttons */}
          <div className="backup-actions">
            <button 
              className="icon-btn" 
              onClick={exportData} 
              title="Экспорт базы данных в JSON"
            >
              <Download size={18} />
            </button>
            <button 
              className="icon-btn" 
              onClick={() => fileInputRef.current?.click()} 
              title="Импорт JSON базы данных"
            >
              <Upload size={18} />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept=".json" 
              onChange={handleFileChange} 
            />
            <button 
              className="icon-btn danger-hover" 
              onClick={resetToDefault} 
              title="Сброс к демо-данным"
            >
              <RotateCcw size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom row: Sprint Select, Search, Team Avatars Filter */}
      {currentUser && (
        <>
          <div className="header-bottom">
            <div className="sprint-selector">
              <span className="sprint-label">Спринт:</span>
              <select 
                value={activeSprintId} 
                onChange={(e) => {
                  setActiveSprintId(e.target.value);
                  setFilters(prev => ({ ...prev, sprintId: e.target.value }));
                }}
                className="sprint-select"
              >
                <option value="all">Все задачи (Общий поток)</option>
                {sprints.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.isActive ? '(Активный)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Search bar */}
            <div className="search-bar">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Поиск по задачам, ID (NEX-...), тегам..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="search-input"
              />
              {filters.search && (
                <button 
                  className="clear-search-btn"
                  onClick={() => setFilters(prev => ({ ...prev, search: '' }))}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Quick Employee Avatar Filter Row */}
            <div className="avatar-filter-section">
              <div className="avatar-filter-header">
                <Filter size={14} />
                <span>Фильтр по команде ({users.length}):</span>
                {filters.assigneeId && (
                  <button 
                    className="reset-avatar-filter"
                    onClick={() => setFilters(prev => ({ ...prev, assigneeId: null }))}
                  >
                    Сбросить
                  </button>
                )}
              </div>

              <div className="avatar-row">
                {users.map((user) => {
                  const isSelected = filters.assigneeId === user.id;
                  return (
                    <div 
                      key={user.id} 
                      className={`avatar-wrapper ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleAvatarClick(user.id)}
                      title={`${user.name} (${user.role} — ${user.department})`}
                    >
                      <img src={user.avatar} alt={user.name} className="user-avatar-img" />
                      {isSelected && <span className="avatar-check">✓</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Extended Filter Toggle */}
            <button 
              className={`filter-toggle-btn ${filters.priority !== 'all' || filters.tag !== 'all' ? 'active' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter size={16} />
              <span>Приоритеты & Теги</span>
              {(filters.priority !== 'all' || filters.tag !== 'all') && (
                <span className="filter-active-dot" />
              )}
            </button>
          </div>

          {/* Expanded Filter Panel */}
          {showFilters && (
            <div className="extended-filters animate-fade-in">
              <div className="filter-group">
                <span className="filter-title">Приоритет:</span>
                <div className="filter-chips">
                  {(['all', 'urgent', 'high', 'medium', 'low'] as const).map((pri) => (
                    <button
                      key={pri}
                      className={`chip ${filters.priority === pri ? 'active' : ''} chip-${pri}`}
                      onClick={() => setFilters(prev => ({ ...prev, priority: pri }))}
                    >
                      {pri === 'all' ? 'Все' : pri.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="filter-group">
                <span className="filter-title">Тег:</span>
                <div className="filter-chips">
                  {(['all', 'Backend', 'Frontend', 'UI/UX', 'DevOps', 'QA', 'Security', 'Architecture'] as const).map((tag) => (
                    <button
                      key={tag}
                      className={`chip ${filters.tag === tag ? 'active' : ''}`}
                      onClick={() => setFilters(prev => ({ ...prev, tag }))}
                    >
                      {tag === 'all' ? 'Все теги' : `#${tag}`}
                    </button>
                  ))}
                </div>
              </div>

              <button 
                className="clear-all-filters-btn"
                onClick={() => setFilters({ search: '', assigneeId: null, priority: 'all', tag: 'all', sprintId: activeSprintId })}
              >
                Сбросить все фильтры
              </button>
            </div>
          )}

          {/* Sprint goal bar */}
          {activeSprint && activeSprintId !== 'all' && (
            <div className="sprint-goal-bar">
              <span className="goal-label">🎯 Цель спринта:</span>
              <span className="goal-text">{activeSprint.goal}</span>
              <span className="sprint-dates">{activeSprint.startDate} — {activeSprint.endDate}</span>
            </div>
          )}
        </>
      )}
    </header>
  );
};
