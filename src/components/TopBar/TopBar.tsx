import React, { useState, useRef } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { Search, Plus, X, Key, Bell } from 'lucide-react';
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
    filters, 
    setFilters,
    isServerConnected,
    onlineUserIds,
    setIsNetworkModalOpen,
    notifications
  } = useTaskContext();
  
  const { currentUser } = useAuth();

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifBtnRef = useRef<HTMLButtonElement>(null);

  const unreadCount = notifications.filter(n => {
    if (n.read || !currentUser) return false;
    if (n.userId === currentUser.id) return true;
    if (n.userId === 'all' && n.type !== 'task_assigned' && n.type !== 'status_changed' && n.type !== 'comment_added') return true;
    return false;
  }).length;

  const handleServerUrlChange = () => setIsNetworkModalOpen(true);

  const handleAvatarClick = (userId: string) => {
    setFilters(prev => ({
      ...prev,
      assigneeId: prev.assigneeId === userId ? null : userId
    }));
  };

  return (
    <div className="topbar-container">
      <div className="topbar-main">
        {/* Left Side: Context Specific tools */}
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

              <div className="avatar-row">
                {users.filter(u => u.id !== 'usr-1' && u.login?.toLowerCase() !== 'admin').map((user) => {
                  const isSelected = filters.assigneeId === user.id;
                  return (
                    <div 
                      key={user.id} 
                      className={`avatar-wrapper ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleAvatarClick(user.id)}
                      title={user.name}
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
              </div>
            </>
          )}
        </div>

        {/* Right Side: Global Actions */}
        <div className="topbar-right">
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
    </div>
  );
};
