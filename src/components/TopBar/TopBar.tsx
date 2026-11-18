import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { Search, Plus, X, Key, Bell, ShieldAlert, FileText, Command, ArrowRight } from 'lucide-react';
import { NotificationPopover } from '../Notifications/NotificationPopover';
import './TopBar.css';

interface TopBarProps {
  onOpenNewTaskModal: () => void;
  onOpenLoginModal: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onOpenNewTaskModal, onOpenLoginModal }) => {
  const { 
    viewMode, 
    setViewMode,
    users, 
    tasks,
    findings,
    hrOrders,
    setActiveTaskModalId,
    filters, 
    setFilters,
    isServerConnected,
    onlineUserIds,
    setIsNetworkModalOpen,
    notifications
  } = useTaskContext();
  
  const { currentUser, isAdmin } = useAuth();

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifBtnRef = useRef<HTMLButtonElement>(null);
  
  const [isAvatarDropdownOpen, setIsAvatarDropdownOpen] = useState(false);
  const avatarDropdownRef = useRef<HTMLDivElement>(null);

  // Command Palette (Ctrl + K) state
  const [isCmdOpen, setIsCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');
  const cmdInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCmdOpen(prev => !prev);
      } else if (e.key === 'Escape' && isCmdOpen) {
        setIsCmdOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCmdOpen]);

  useEffect(() => {
    if (isCmdOpen) {
      setTimeout(() => cmdInputRef.current?.focus(), 50);
    } else {
      setCmdQuery('');
    }
  }, [isCmdOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (avatarDropdownRef.current && !avatarDropdownRef.current.contains(event.target as Node)) {
        setIsAvatarDropdownOpen(false);
      }
    };
    if (isAvatarDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAvatarDropdownOpen]);

  const unreadCount = notifications.filter(n => {
    if (n.read || !currentUser) return false;
    if (n.userId === currentUser.id) return true;
    if (n.userId === 'all' && n.type !== 'task_assigned' && n.type !== 'status_changed' && n.type !== 'comment_added') return true;
    return false;
  }).length;

  const handleServerUrlChange = () => setIsNetworkModalOpen(true);

  const displayUsers = users.filter(u => u.id !== 'usr-1' && u.login?.toLowerCase() !== 'admin');
  const sortedUsers = [...displayUsers].sort((a, b) => {
    if (filters.assigneeId === a.id) return -1;
    if (filters.assigneeId === b.id) return 1;
    return 0;
  });
  const MAX_VISIBLE = 4;
  const visibleUsers = sortedUsers.slice(0, MAX_VISIBLE);
  const hiddenUsersCount = sortedUsers.length - MAX_VISIBLE;

  const handleAvatarClick = (userId: string) => {
    setFilters(prev => ({
      ...prev,
      assigneeId: prev.assigneeId === userId ? null : userId
    }));
  };

  // Live SecOps metrics for TopBar status pills
  const activeCritFindingsCount = useMemo(() => {
    return (findings || []).filter(f => (f.status === 'new' || f.status === 'analyzing') && (f.severity === 'Critical' || f.severity === 'High')).length;
  }, [findings]);

  const pendingHrOrdersCount = useMemo(() => {
    return (hrOrders || []).filter(o => !o.isArchived).length;
  }, [hrOrders]);

  // Command Palette search results
  const cmdResults = useMemo(() => {
    const q = cmdQuery.trim().toLowerCase();
    const matchedTasks = (tasks || [])
      .filter(t => !q || t.id.toLowerCase().includes(q) || (t.title || '').toLowerCase().includes(q) || (t.tags || []).some(tag => tag.toLowerCase().includes(q)))
      .slice(0, 6);

    const matchedHr = (hrOrders || [])
      .filter(o => q && ((o.fullName || '').toLowerCase().includes(q) || (o.newPosition || '').toLowerCase().includes(q) || (o.pcName || '').toLowerCase().includes(q)))
      .slice(0, 4);

    const matchedFindings = (findings || [])
      .filter(f => q && ((f.title || '').toLowerCase().includes(q) || (f.project || '').toLowerCase().includes(q) || (f.cwe || '').toLowerCase().includes(q)))
      .slice(0, 4);

    return { matchedTasks, matchedHr, matchedFindings };
  }, [cmdQuery, tasks, hrOrders, findings]);

  return (
    <div className="topbar-container">
      <div className="topbar-main">
        {/* Left Side: Search + Ctrl+K Trigger + Avatars */}
        <div className="topbar-left">
          {currentUser && (viewMode === 'board' || viewMode === 'backlog' || viewMode === 'workload') && (
            <>
              <div className="search-bar">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Поиск задач..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="search-input"
                />
                {filters.search && (
                  <button className="clear-search-btn" onClick={() => setFilters(prev => ({ ...prev, search: '' }))}>
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="avatar-row" ref={avatarDropdownRef} style={{ position: 'relative' }}>
                {visibleUsers.map((user) => {
                  const isSelected = filters.assigneeId === user.id;
                  return (
                    <div 
                      key={user.id} 
                      className={`avatar-wrapper ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleAvatarClick(user.id)}
                      title={user.name}
                      style={{ zIndex: isSelected ? 5 : 1 }}
                    >
                      {user.avatar ? (
                        <img src={user.avatar} alt="" className="user-avatar-img" />
                      ) : (
                        <div className="user-avatar-img fallback-avatar">
                          {((user.name || '?')[0]).toUpperCase()}
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {hiddenUsersCount > 0 && (
                  <div 
                    className="avatar-wrapper extra-avatars"
                    onClick={() => setIsAvatarDropdownOpen(!isAvatarDropdownOpen)}
                    style={{ 
                      backgroundColor: 'hsl(var(--surface))', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      fontSize: '12px', 
                      fontWeight: 600, 
                      color: 'hsl(var(--text-main))', 
                      zIndex: 1,
                      border: '2px solid hsl(var(--bg-main))'
                    }}
                    title="Показать остальных"
                  >
                    +{hiddenUsersCount}
                  </div>
                )}

                {isAvatarDropdownOpen && (
                  <div className="avatar-dropdown glass-panel" style={{ 
                    position: 'absolute', 
                    top: '100%', 
                    left: '0', 
                    marginTop: '8px', 
                    padding: '8px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '4px', 
                    zIndex: 100, 
                    minWidth: '220px', 
                    maxHeight: '350px', 
                    overflowY: 'auto',
                    borderRadius: '8px'
                  }}>
                    {sortedUsers.map(user => (
                      <div 
                        key={user.id}
                        onClick={() => {
                          handleAvatarClick(user.id);
                          setIsAvatarDropdownOpen(false);
                        }}
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '10px', 
                          padding: '6px 8px', 
                          borderRadius: '6px', 
                          cursor: 'pointer', 
                          backgroundColor: filters.assigneeId === user.id ? 'hsla(var(--primary), 0.15)' : 'transparent',
                          transition: 'background-color 0.2s'
                        }}
                      >
                        {user.avatar ? (
                          <img src={user.avatar} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: '#e2e8f0', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>
                            {((user.name || '?')[0]).toUpperCase()}
                          </div>
                        )}
                        <span style={{ 
                          fontSize: '0.85rem', 
                          color: filters.assigneeId === user.id ? 'hsl(var(--primary))' : 'hsl(var(--text-main))',
                          fontWeight: filters.assigneeId === user.id ? 600 : 400
                        }}>
                          {user.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {currentUser && (
            <button
              className="btn-secondary"
              onClick={() => setIsCmdOpen(true)}
              title="Глобальный поиск по системе и быстрый переход (Ctrl + K)"
              style={{
                padding: '6px 12px',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: 'hsl(var(--text-secondary))',
                background: 'rgba(255,255,255,0.04)'
              }}
            >
              <Command size={14} />
              <span>Быстрый переход</span>
              <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 6px', borderRadius: '4px', fontSize: '0.7rem', fontFamily: 'monospace' }}>Ctrl+K</kbd>
            </button>
          )}
        </div>

        {/* Right Side: Live SecOps Status Pills & Global Actions */}
        <div className="topbar-right">
          {currentUser && activeCritFindingsCount > 0 && (
            <button
              className="btn-secondary"
              onClick={() => setViewMode('security')}
              title="Перейти к критическим уязвимостям в Центре Безопасности"
              style={{
                padding: '5px 10px',
                fontSize: '0.76rem',
                fontWeight: 700,
                background: 'rgba(239, 68, 68, 0.14)',
                borderColor: 'rgba(239, 68, 68, 0.4)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <ShieldAlert size={14} />
              <span>{activeCritFindingsCount} Crit/High</span>
            </button>
          )}

          {currentUser && pendingHrOrdersCount > 0 && (
            <button
              className="btn-secondary"
              onClick={() => setViewMode('security')}
              title="Активные HR Приказы JML в работе"
              style={{
                padding: '5px 10px',
                fontSize: '0.76rem',
                fontWeight: 700,
                background: 'rgba(245, 158, 11, 0.14)',
                borderColor: 'rgba(245, 158, 11, 0.4)',
                color: '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <FileText size={14} />
              <span>JML: {pendingHrOrdersCount}</span>
            </button>
          )}

          <button
            className="btn-secondary server-status-btn"
            onClick={handleServerUrlChange}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: isServerConnected ? '#22c55e' : '#ef4444', display: 'inline-block' }} />
            {isServerConnected ? `LAN (${onlineUserIds.length})` : 'Отключен'}
          </button>

          {currentUser && (
            <div style={{ position: 'relative' }}>
              <button ref={notifBtnRef} className="icon-btn" onClick={() => setIsNotifOpen(!isNotifOpen)}>
                <Bell size={18} />
                {unreadCount > 0 && <span className="notif-badge-pill">{unreadCount > 9 ? '9+' : unreadCount}</span>}
              </button>
              <NotificationPopover isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} anchorRef={notifBtnRef} />
            </div>
          )}

          <button
            className="btn-secondary profile-btn"
            onClick={() => currentUser ? setViewMode('profile') : onOpenLoginModal()}
          >
            {currentUser ? (
              <>
                {currentUser.avatar ? (
                  <img src={currentUser.avatar} alt={currentUser.name} className="profile-img" />
                ) : (
                  <div className="profile-img fallback-avatar">{currentUser.name[0]}</div>
                )}
                <span>{currentUser.name.split(' ').map((p, i) => i === 0 ? p : p[0].toUpperCase() + '.').join(' ')}</span>
              </>
            ) : (
              <>
                <Key size={16} style={{ color: 'var(--primary)' }} />
                <span>Вход</span>
              </>
            )}
          </button>

          {currentUser && (
            <button className="btn-primary" onClick={onOpenNewTaskModal}>
              <Plus size={18} />
              <span>Создать</span>
            </button>
          )}
        </div>
      </div>

      {/* Command Palette Modal (Ctrl + K) */}
      {isCmdOpen && (
        <div
          className="modal-overlay"
          onClick={() => setIsCmdOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '10vh'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '92%',
              maxWidth: '640px',
              background: 'hsl(var(--bg-secondary))',
              border: '1px solid hsl(var(--border-color))',
              borderRadius: '14px',
              boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
              overflow: 'hidden'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', borderBottom: '1px solid hsl(var(--border-color))' }}>
              <Search size={18} style={{ color: 'hsl(var(--primary))' }} />
              <input
                ref={cmdInputRef}
                type="text"
                value={cmdQuery}
                onChange={e => setCmdQuery(e.target.value)}
                placeholder="Поиск по ID задачи (NEX-2001), названию, ФИО в приказах JML, CWE или раздел..."
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'hsl(var(--text-primary))',
                  fontSize: '0.95rem'
                }}
              />
              <kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', color: 'hsl(var(--text-secondary))' }}>ESC</kbd>
            </div>

            <div style={{ maxHeight: '420px', overflowY: 'auto', padding: '12px' }}>
              {/* Quick Navigation */}
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', padding: '4px 8px' }}>
                Быстрая навигация по модулям
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px', marginBottom: '14px' }}>
                {[
                  { mode: 'board', label: '📋 Канбан-доска' },
                  { mode: 'backlog', label: '🗄️ Бэклог и Архив спринтов' },
                  { mode: 'security', label: '🛡️ Центр Безопасности и JML' },
                  { mode: 'architecture', label: '🗺️ Схема архитектуры ДКБ' },
                  { mode: 'analytics', label: '📊 Аналитика и PDF отчеты' },
                  ...(isAdmin ? [{ mode: 'admin', label: '⚙️ Админ-панель и Live Логи' }] : [])
                ].map(item => (
                  <button
                    key={item.mode}
                    onClick={() => {
                      setViewMode(item.mode as any);
                      setIsCmdOpen(false);
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      color: 'hsl(var(--text-primary))',
                      textAlign: 'left',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span>{item.label}</span>
                    <ArrowRight size={13} style={{ opacity: 0.6 }} />
                  </button>
                ))}
              </div>

              {/* Tasks Results */}
              {cmdResults.matchedTasks.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', padding: '4px 8px' }}>
                    Задачи ({cmdResults.matchedTasks.length})
                  </div>
                  {cmdResults.matchedTasks.map(t => (
                    <div
                      key={t.id}
                      onClick={() => {
                        setActiveTaskModalId(t.id);
                        setIsCmdOpen(false);
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px'
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'hsl(var(--primary))', fontSize: '0.82rem' }}>{t.id}</span>
                        <span style={{ fontSize: '0.86rem', color: 'hsl(var(--text-primary))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
                      </div>
                      <span style={{ fontSize: '0.74rem', color: 'hsl(var(--text-secondary))', flexShrink: 0 }}>{t.status}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* HR JML Results */}
              {cmdResults.matchedHr.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', padding: '4px 8px' }}>
                    HR Приказы JML ({cmdResults.matchedHr.length})
                  </div>
                  {cmdResults.matchedHr.map(o => (
                    <div
                      key={o.id}
                      onClick={() => {
                        setViewMode('security');
                        setIsCmdOpen(false);
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div>
                        <strong style={{ fontSize: '0.86rem', color: 'hsl(var(--text-primary))' }}>{o.fullName}</strong>
                        <span style={{ marginLeft: '8px', fontSize: '0.78rem', color: 'hsl(var(--text-secondary))' }}>{o.type} ({o.date})</span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#f59e0b' }}>Открыть в JML →</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Findings Results */}
              {cmdResults.matchedFindings.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', padding: '4px 8px' }}>
                    Уязвимости ИБ ({cmdResults.matchedFindings.length})
                  </div>
                  {cmdResults.matchedFindings.map(f => (
                    <div
                      key={f.id}
                      onClick={() => {
                        setViewMode('security');
                        setIsCmdOpen(false);
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-primary))' }}>{f.title}</span>
                      <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 700 }}>{f.severity}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
