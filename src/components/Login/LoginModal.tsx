import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import './LoginModal.css';

interface LoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { login, sessionExpired, clearSessionExpired } = useAuth();
  
  const [loginInput, setLoginInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [error, setError] = useState<string>('');

  if (!isOpen) return null;

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginInput.trim() || !passwordInput.trim()) {
      setError('Пожалуйста, введите логин и пароль');
      return;
    }

    const res = await login(loginInput.trim(), passwordInput.trim());
    if (res.success) {
      setError('');
      setPasswordInput('');
      clearSessionExpired();
      if (onClose) onClose();
    } else {
      setError(res.error || 'Неверный логин или пароль');
    }
  };

  return (
    <div className="login-modal-overlay">
      <div className="login-modal-card glass-panel animate-scale-up">
        
        <div className="login-modal-header">
          <div>
            <h2 className="login-modal-title">🔐 Авторизация Pulse 12</h2>
            <p className="login-modal-subtitle">Корпоративная система управления проектами</p>
          </div>
          {onClose && (
            <button className="icon-btn" onClick={onClose} title="Закрыть">✕</button>
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

        <div className="login-modal-body">
          {error && <div className="login-error-msg">⚠️ {error}</div>}

          <form className="credentials-form" onSubmit={handleCredentialsSubmit}>
            <div className="form-group-login">
              <label className="login-field-label">Логин или Email</label>
              <input
                type="text"
                className="login-search-input"
                placeholder="Введите ваш корпоративный логин или email..."
                value={loginInput}
                onChange={e => setLoginInput(e.target.value)}
                autoFocus
              />
            </div>

            <div className="form-group-login">
              <label className="login-field-label">Пароль</label>
              <input
                type="password"
                className="login-search-input"
                placeholder="Введите ваш корпоративный пароль..."
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
              />
            </div>

            <button type="submit" className="btn-primary login-submit-btn" style={{ width: '100%', marginTop: '16px' }}>
              🚀 Войти в систему
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
