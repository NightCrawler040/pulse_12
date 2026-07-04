import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTaskContext } from '../../context/TaskContext';
import './AdminPanel.css';

export const AdminLoginPrompt: React.FC = () => {
  const { login, currentUser } = useAuth();
  const { setViewMode } = useTaskContext();
  const [loginInput, setLoginInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginInput.trim() || !passwordInput.trim()) {
      setError('Пожалуйста, введите логин и пароль администратора');
      return;
    }
    const res = login(loginInput.trim(), passwordInput.trim());
    if (!res.success) {
      setError(res.error || 'Неверные учетные данные администратора');
      return;
    }
    // Checking if the newly logged in user is actually an admin happens via AuthContext rerender
  };

  return (
    <div className="admin-panel-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh' }}>
      <div style={{
        background: 'var(--card-bg, #1e2230)',
        border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '440px',
        width: '100%',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
        <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>
          Защищенный раздел /admin
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary, #94a3b8)', marginBottom: '24px', lineHeight: 1.5 }}>
          Для доступа к панели управления корпоративной сетью требуется авторизация с правами <b>Администратора</b>.
          {currentUser && (
            <span style={{ display: 'block', marginTop: '8px', color: '#f59e0b' }}>
              Текущая учетка (<b>{currentUser.name}</b>) не имеет прав админа.
            </span>
          )}
        </p>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            color: '#ef4444',
            padding: '10px',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '13px',
            textAlign: 'left'
          }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px', fontWeight: 500 }}>
              Логин или Email администратора:
            </label>
            <input
              type="text"
              placeholder="например, admin"
              value={loginInput}
              onChange={(e) => setLoginInput(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #334155)',
                background: 'rgba(0,0,0,0.2)',
                color: '#fff',
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px', fontWeight: 500 }}>
              Пароль или PIN-код:
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #334155)',
                background: 'rgba(0,0,0,0.2)',
                color: '#fff',
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={() => setViewMode('board')}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                background: 'transparent',
                border: '1px solid var(--border-color, #475569)',
                color: '#cbd5e1',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              ← На доску
            </button>
            <button
              type="submit"
              style={{
                flex: 2,
                padding: '12px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                border: 'none',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)'
              }}
            >
              Войти как Админ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
