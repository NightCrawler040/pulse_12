import React, { useState } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { getServerUrl, setServerUrl } from '../../services/api';
import './NetworkModal.css';

export const NetworkModal: React.FC = () => {
  const { isNetworkModalOpen, setIsNetworkModalOpen, isServerConnected, users, onlineUserIds } = useTaskContext();
  const { currentUser } = useAuth();
  const [inputUrl, setInputUrl] = useState<string>(() => getServerUrl());
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  if (!isNetworkModalOpen) return null;

  const onlineUsersList = users.filter(u => onlineUserIds.includes(u.id) || (currentUser && u.id === currentUser.id));

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputUrl.trim()) {
      setServerUrl(inputUrl.trim());
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        setIsNetworkModalOpen(false);
      }, 1200);
    }
  };

  const handleResetAuto = () => {
    const defaultUrl = `${window.location.protocol}//${window.location.hostname || 'localhost'}:3001`;
    setInputUrl(defaultUrl);
    setServerUrl(defaultUrl);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 1200);
  };

  return (
    <div className="network-modal-overlay" onClick={() => setIsNetworkModalOpen(false)}>
      <div className="network-modal-container glass-panel" onClick={e => e.stopPropagation()}>
        <div className="network-modal-header">
          <div className="header-title-row">
            <span className="network-modal-icon">🌐</span>
            <div>
              <h3>Корпоративная сеть и Статус сервера</h3>
              <p className="subtitle">Синхронизация базы данных и активность сотрудников в офисе</p>
            </div>
          </div>
          <button className="btn-close" onClick={() => setIsNetworkModalOpen(false)} title="Закрыть">✖</button>
        </div>

        <div className="network-modal-body">
          {/* Статус подключения */}
          <div className="connection-status-card">
            <div className="status-indicator-wrapper">
              <span className={`status-dot-large ${isServerConnected ? 'online-pulse' : 'offline-pulse'}`} />
              <div className="status-text">
                <h4>{isServerConnected ? '🟢 Сервер доступен и синхронизирован' : '⚠️ Офлайн режим (Локальное хранилище)'}</h4>
                <p>
                  {isServerConnected
                    ? 'Все изменения (задачи, комментарии, файлы) мгновенно сохраняются в базу данных на сервере и появляются у всех 12 сотрудников.'
                    : 'Связь с сервером временно потеряна. Изменения сохраняются локально в вашем браузере и синхронизируются при появлении связи.'}
                </p>
              </div>
            </div>
          </div>

          {/* Список сотрудников онлайн */}
          <div className="online-users-section">
            <div className="section-title-row">
              <h4>👥 Сотрудники сейчас в сети ({onlineUsersList.length})</h4>
              <span className="online-badge">LAN Active</span>
            </div>
            <div className="online-users-grid">
              {onlineUsersList.length > 0 ? (
                onlineUsersList.map(u => (
                  <div key={u.id} className="online-user-card">
                    <div className="avatar-wrapper">
                      <img src={u.avatar} alt={u.name} />
                      <span className="online-dot-badge" title="В сети" />
                    </div>
                    <div className="user-info">
                      <span className="name">{u.name}</span>
                      <span className="department">{u.department} • {u.role}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="empty-online-notice">Нет других активных подключений в данный момент.</p>
              )}
            </div>
          </div>

          {/* Настройка адреса сервера */}
          <div className="server-config-section">
            <h4>⚙️ Настройки адреса сервера (IP или домен)</h4>
            <p className="config-help">
              При работе на виртуальной машине **VMware vSphere** или в корпоративной сети Ubuntu, адрес сервера определяется автоматически. Изменяйте это поле только если вы хотите подключить ноутбук к другому серверу или при смене IP-адреса.
            </p>
            <form onSubmit={handleSave} className="server-url-form">
              <div className="input-group">
                <span className="input-prefix">Адрес:</span>
                <input
                  type="text"
                  value={inputUrl}
                  onChange={e => setInputUrl(e.target.value)}
                  placeholder="например: http://192.168.1.100:3001"
                  className="server-url-input"
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={handleResetAuto}>
                  🔄 Автоопределение
                </button>
                <button type="submit" className="btn-primary">
                  {savedSuccess ? '✅ Сохранено!' : '💾 Сохранить адрес'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="network-modal-footer">
          <span className="footer-hint">💡 Для корпоративной работы рекомендуется единый адрес http://[IP-машины]/</span>
          <button className="btn-secondary" onClick={() => setIsNetworkModalOpen(false)}>Готово</button>
        </div>
      </div>
    </div>
  );
};
