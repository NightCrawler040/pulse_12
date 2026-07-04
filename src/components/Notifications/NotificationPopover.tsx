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
  const { notifications, markNotificationRead, markAllNotificationsRead, setActiveTaskModalId } = useTaskContext();
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
        // If arrived within last 5 seconds, show toast
        if (now - notifTime < 5000 && !toastList.some(t => t.id === latest.id)) {
          setToastList(prev => [...prev, latest]);
          const timer = setTimeout(() => {
            setToastList(prev => prev.filter(t => t.id !== latest.id));
          }, 5000);
          return () => clearTimeout(timer);
        }
      }
    }
  }, [myNotifications, toastList]);

  const handleNotificationClick = (notif: any) => {
    markNotificationRead(notif.id);
    if (notif.linkTaskId) {
      setActiveTaskModalId(notif.linkTaskId);
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
              {myNotifications.some(n => !n.read) && (
                <button className="btn-mark-all" onClick={markAllNotificationsRead}>
                  ✔ Прочитать все
                </button>
              )}
            </div>

            <div className="notif-list">
              {myNotifications.length > 0 ? (
                myNotifications.map(n => (
                  <div
                    key={n.id}
                    className={`notif-item ${n.read ? 'read' : 'unread'}`}
                    onClick={() => handleNotificationClick(n)}
                  >
                    <div className="notif-icon-badge">
                      {n.type === 'task_assigned' ? '👤' : n.type === 'status_changed' ? '🔄' : n.type === 'comment_added' ? '💬' : '📢'}
                    </div>
                    <div className="notif-content">
                      <span className="notif-title">{n.title}</span>
                      <p className="notif-message">{n.message}</p>
                      <span className="notif-time">{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {!n.read && <span className="unread-dot" />}
                  </div>
                ))
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
            <button className="toast-close" onClick={(e) => { e.stopPropagation(); setToastList(prev => prev.filter(t => t.id !== toast.id)); }}>✖</button>
          </div>
        ))}
      </div>
    </>
  );
};
