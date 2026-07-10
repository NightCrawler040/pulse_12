import React, { useState, useEffect } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import './NotificationPopover.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

export const NotificationPopover: React.FC<Props> = ({ isOpen, onClose }) => {
  const { notifications, markNotificationRead, markAllNotificationsRead, deleteNotification, clearAllNotifications, setActiveTaskModalId, setViewMode } = useTaskContext();
  const { currentUser } = useAuth();
  const [toastList, setToastList] = useState<any[]>([]);

  // Filter notifications relevant to current user
  const myNotifications = notifications.filter(n => {
    if (!currentUser) return false;
    if (n.userId === currentUser.id) return true;
    if (n.userId === 'all' && n.type !== 'task_assigned' && n.type !== 'status_changed' && n.type !== 'comment_added') return true;
    return false;
  });

  // Show toast when a new notification arrives
  useEffect(() => {
    if (myNotifications.length > 0) {
      const latest = myNotifications[0];
      if (!latest.read) {
        const now = new Date().getTime();
        const notifTime = new Date(latest.createdAt).getTime();
        // If arrived within last 10 seconds, add to toast list
        if (now - notifTime < 10000 && !toastList.some(t => t.id === latest.id)) {
          setToastList(prev => [...prev, latest]);
        }
      }
    }
  }, [myNotifications]);

  // Auto dismiss toasts after 10 seconds; if a new toast arrived, timer resets ("обнуляется по таймеру")
  useEffect(() => {
    if (toastList.length === 0) return;
    const timer = setTimeout(() => {
      setToastList([]);
    }, 10000);
    return () => clearTimeout(timer);
  }, [toastList]);

  const handleNotificationClick = (notif: any) => {
    markNotificationRead(notif.id);
    setToastList(prev => prev.filter(t => t.id !== notif.id));
    deleteNotification(notif.id);
    const targetId = notif.linkTaskId || notif.taskId || notif.linkId || (notif.message?.match(/(NEX-\d+)/)?.[1]);
    if (targetId) {
      setViewMode('board');
      setActiveTaskModalId(targetId);
      onClose();
    }
  };

  return (
    <>
      {/* Popover */}
      {isOpen && (
        <>
          <div className="notif-backdrop" onClick={onClose} />
          <div className="notif-popover glass-panel">
            <div className="notif-header">
              <div className="notif-title-row">
                <span>🔔</span>
                <h4>Уведомления</h4>
              </div>
              {myNotifications.length > 0 && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  {myNotifications.some(n => !n.read) && (
                    <button className="btn-mark-all" onClick={() => { markAllNotificationsRead(); setToastList([]); }}>
                      ✔ Прочитать все
                    </button>
                  )}
                  <button
                    className="btn-mark-all"
                    style={{ color: '#f87171', borderColor: 'rgba(248,113,113,0.3)' }}
                    onClick={() => { clearAllNotifications(); setToastList([]); }}
                  >
                    🗑 Очистить
                  </button>
                </div>
              )}
            </div>

            <div className="notif-list">
              {myNotifications.length > 0 ? (
                myNotifications.map(n => {
                  const hasLink = !!(n.linkTaskId || (n as any).taskId || (n as any).linkId || (n.message?.match(/(NEX-\d+)/)?.[1]));
                  return (
                    <div
                      key={n.id}
                      className={`notif-item ${n.read ? 'read' : 'unread'}`}
                      onClick={() => handleNotificationClick(n)}
                      style={{ cursor: 'pointer', position: 'relative' }}
                      title={hasLink ? "Нажмите, чтобы открыть задачу и удалить уведомление" : "Нажмите, чтобы подтвердить и удалить уведомление"}
                    >
                      <div className="notif-icon-badge">
                        {n.type === 'task_assigned' ? '👤' : n.type === 'status_changed' ? '🔄' : n.type === 'comment_added' ? '💬' : '📢'}
                      </div>
                      <div className="notif-content">
                        <span className="notif-title">
                          {n.title} {hasLink && <span style={{ fontSize: '0.75rem', color: 'hsl(var(--primary))', fontWeight: 'bold' }}>↗ Открыть</span>}
                        </span>
                        <p className="notif-message">{n.message}</p>
                        <span className="notif-time">{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {!n.read && <span className="unread-dot" />}
                        <button
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'hsl(var(--muted-foreground))',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            padding: '4px'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(n.id);
                            setToastList(prev => prev.filter(t => t.id !== n.id));
                          }}
                          title="Удалить уведомление"
                        >
                          ✖
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="empty-notif">
                  <span>💤</span>
                  <p>У вас пока нет новых уведомлений</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Floating Toast Alerts in bottom right */}
      <div className="toast-container">
        {toastList.map(toast => (
          <div key={toast.id} className="toast-card glass-panel" onClick={() => handleNotificationClick(toast)}>
            <div className="toast-icon">🔔</div>
            <div className="toast-body">
              <strong>{toast.title}</strong>
              <p>{toast.message}</p>
            </div>
            <button className="toast-close" onClick={(e) => { e.stopPropagation(); deleteNotification(toast.id); setToastList(prev => prev.filter(t => t.id !== toast.id)); }}>✖</button>
          </div>
        ))}
      </div>
    </>
  );
};
