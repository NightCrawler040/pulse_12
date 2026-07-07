import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTaskContext } from '../../context/TaskContext';
import type { User } from '../../types';
import './LoginModal.css';

interface LoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { users } = useTaskContext();
  const { login, currentUser, sessionExpired, clearSessionExpired } = useAuth();
  
  const [mode, setMode] = useState<'credentials' | 'select'>('credentials');
  const [loginInput, setLoginInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  
  const [selectedUser, setSelectedUser] = useState<User | null>(currentUser || null);
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  if (!isOpen) return null;

  const activeUsers = users.filter(u => u.isActive !== false);
  const filteredUsers = activeUsers.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setError('');
    setPin(user.roleType === 'admin' ? 'admin' : '1234');
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginInput.trim() || !passwordInput.trim()) {
      setError('Пожалуйста, введите Логин и Пароль');
      return;
    }
    const result = await login(loginInput.trim(), passwordInput.trim());
    if (result.success) {
      setError('');
      clearSessionExpired();
      if (onClose) onClose();
    } else {
      setError(result.error || 'Неверный логин или пароль');
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) {
      setError('Пожалуйста, выберите сотрудника из списка');
      return;
    }
    const result = await login(selectedUser.id, pin);
    if (result.success) {
      setError('');
      clearSessionExpired();
      if (onClose) onClose();
    } else {
      setError(result.error || 'Неверный PIN-код или пароль');
    }
  };

  const getRoleBadge = (roleType?: string) => {
    if (roleType === 'admin') return <span className="role-badge-mini role-admin">Администратор</span>;
    if (roleType === 'manager') return <span className="role-badge-mini role-manager">Руководитель</span>;
    return <span className="role-badge-mini role-member">Сотрудник</span>;
  };

  return (
    <div className="login-modal-overlay animate-fade-in" onClick={() => onClose && currentUser && onClose()}>
      <div className="login-modal-card" onClick={e => e.stopPropagation()}>
        
        <div className="login-modal-header">
          <div className="login-title-box">
            <h2 className="login-title">
              <span>🔐</span> Корпоративный портал Pulse 12
            </h2>
            <p className="login-subtitle">Авторизуйтесь в системе под своей учетной записью</p>
          </div>
          {onClose && currentUser && (
            <button className="btn-secondary" onClick={onClose} style={{ padding: '6px 12px' }}>
              ✕ Закрыть
            </button>
          )}
        </div>

        {sessionExpired && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            color: '#ef4444',
            padding: '12px 16px',
            borderRadius: '10px',
            margin: '16px 24px 0 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '14px',
            fontWeight: 500
          }}>
            <span style={{ fontSize: '18px' }}>🕒</span>
            <span>Ваш сеанс был автоматически завершен из-за отсутствия активности в течение 15 минут. Пожалуйста, войдите снова.</span>
          </div>
        )}

        <div className="login-tabs-row">
          <button 
            className={`login-tab-btn ${mode === 'credentials' ? 'active' : ''}`}
            onClick={() => { setMode('credentials'); setError(''); }}
          >
            🔑 Вход по Логину и Паролю
          </button>
          <button 
            className={`login-tab-btn ${mode === 'select' ? 'active' : ''}`}
            onClick={() => { setMode('select'); setError(''); }}
          >
            👥 Быстрый выбор сотрудника
          </button>
        </div>

        <div className="login-modal-body">
          {error && <div className="login-error-msg">⚠️ {error}</div>}

          {mode === 'credentials' ? (
            <form className="credentials-form" onSubmit={handleCredentialsSubmit}>
              <div className="form-group-login">
                <label className="login-field-label">Логин / Email</label>
                <input
                  type="text"
                  className="login-search-input"
                  placeholder="Введите ваш логин (например: admin, evasileva)..."
                  value={loginInput}
                  onChange={e => setLoginInput(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="form-group-login">
                <label className="login-field-label">Пароль / PIN</label>
                <input
                  type="password"
                  className="login-search-input"
                  placeholder="Введите ваш пароль (например: admin или 1234)..."
                  value={passwordInput}
                  onChange={e => setPasswordInput(e.target.value)}
                />
              </div>

              <div className="credentials-hint">
                💡 <strong>Подсказка по умолчанию:</strong> для техлида логин <code>admin</code> (пароль <code>admin</code>). Для сотрудников логины по имени (например, <code>evasileva</code>, <code>dsokolov</code>, пароль <code>1234</code>).
              </div>

              <button type="submit" className="btn-primary login-submit-btn" style={{ width: '100%', marginTop: '8px' }}>
                🚀 Войти в систему
              </button>
            </form>
          ) : (
            <>
              <input
                type="text"
                className="login-search-input"
                placeholder="🔍 Поиск сотрудника по имени, роли или отделу..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />

              <div className="users-grid">
                {filteredUsers.map(u => {
                  const isSelected = selectedUser?.id === u.id;
                  return (
                    <div
                      key={u.id}
                      className={`user-select-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectUser(u)}
                    >
                      <img src={u.avatar} alt={u.name} className="user-card-avatar" />
                      <div className="user-card-info">
                        <span className="user-card-name">{u.name}</span>
                        <span className="user-card-role">{u.role}</span>
                        {getRoleBadge(u.roleType)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedUser && (
                <form className="pin-entry-box" onSubmit={handlePinSubmit}>
                  <div className="pin-header-row">
                    <div className="selected-user-preview">
                      <img src={selectedUser.avatar} alt={selectedUser.name} className="preview-avatar" />
                      <div>
                        <div className="preview-name">{selectedUser.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>
                          Вход в систему ({selectedUser.email})
                        </div>
                      </div>
                    </div>
                    <span className="default-hint">
                      💡 PIN по умолчанию: <strong>{selectedUser.roleType === 'admin' ? 'admin' : '1234'}</strong>
                    </span>
                  </div>

                  <div className="pin-input-group">
                    <input
                      type="password"
                      className="pin-input-field"
                      placeholder="Введите PIN-код или пароль"
                      value={pin}
                      onChange={e => setPin(e.target.value)}
                      autoFocus
                    />
                    <button type="submit" className="btn-primary login-submit-btn">
                      🚀 Войти
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
};
