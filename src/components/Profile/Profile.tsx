import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTaskContext } from '../../context/TaskContext';
import { apiService } from '../../services/api';
import type { User } from '../../types';
import './Profile.css';

export const Profile: React.FC = () => {
  const { currentUser, updateCurrentUserProfile, logout } = useAuth();
  const { tasks, groups, onlineUserIds, setActiveTaskModalId, columns } = useTaskContext();

  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [quickPassword, setQuickPassword] = useState('');
  const [quickPasswordConfirm, setQuickPasswordConfirm] = useState('');
  const [pwdMsg, setPwdMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [department, setDepartment] = useState(currentUser?.department || '');
  const [avatar, setAvatar] = useState(currentUser?.avatar || '');
  const [pin, setPin] = useState(currentUser?.pin || '1234');
  const [isUploading, setIsUploading] = useState(false);

  if (!currentUser) {
    return (
      <div className="profile-container" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <h2>⚠️ Вы не вошли в систему</h2>
        <p style={{ color: 'hsl(var(--text-secondary))', marginTop: '10px' }}>
          Пожалуйста, войдите под своим профилем, чтобы открыть личный кабинет.
        </p>
      </div>
    );
  }

  const handleQuickPasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPassword.trim()) {
      setPwdMsg({ text: '⚠️ Введите новый пароль', type: 'error' });
      return;
    }
    if (quickPassword !== quickPasswordConfirm) {
      setPwdMsg({ text: '⚠️ Пароли не совпадают!', type: 'error' });
      return;
    }
    updateCurrentUserProfile({
      password: quickPassword.trim(),
      pin: quickPassword.trim()
    });
    setQuickPassword('');
    setQuickPasswordConfirm('');
    setIsChangingPassword(false);
    setPwdMsg({ text: '✅ Пароль успешно изменен и захеширован в базе!', type: 'success' });
    setTimeout(() => setPwdMsg(null), 5000);
  };

  const isOnline = onlineUserIds.includes(currentUser.id);
  const myDirectTasks = tasks.filter(t => t.assigneeId === currentUser.id);
  
  // Group tasks
  const myGroupIds = groups.filter(g => g.memberIds.includes(currentUser.id)).map(g => g.id);
  const myGroupTasks = tasks.filter(t => t.assigneeGroupId && myGroupIds.includes(t.assigneeGroupId) && t.assigneeId !== currentUser.id);
  const allMyTasks = tasks.filter(t => t.assigneeId === currentUser.id || (t.assigneeGroupId && myGroupIds.includes(t.assigneeGroupId)));

  const completedTasks = allMyTasks.filter(t => t.status === 'done');
  const completionRate = allMyTasks.length > 0 ? Math.round((completedTasks.length / allMyTasks.length) * 100) : 0;
  const totalLoggedHours = allMyTasks.reduce((sum, t) => sum + (t.loggedHours || 0), 0);
  const totalEstimatedHours = allMyTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
  const totalStoryPoints = allMyTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updates: Partial<User> = {
      name: name.trim(),
      email: email.trim(),
      department: department.trim(),
      avatar: avatar.trim() || currentUser.avatar
    };
    if (pin.trim()) {
      updates.pin = pin.trim();
      updates.password = pin.trim();
    }
    updateCurrentUserProfile(updates);
    setIsEditing(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        const res = await apiService.uploadAvatar(base64, file.name);
        if (res.success) {
          setAvatar(res.url);
        }
      } catch (err) {
        console.error('Failed to upload avatar', err);
        alert('Ошибка загрузки фотографии');
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const getStatusLabel = (status: string) => {
    const col = columns.find(c => c.id === status);
    return col ? col.title : status;
  };

  const getRoleBadge = (roleType?: string) => {
    if (roleType === 'admin') return <span className="role-badge-mini role-admin">Администратор</span>;
    if (roleType === 'manager') return <span className="role-badge-mini role-manager">Руководитель</span>;
    return <span className="role-badge-mini role-member">Сотрудник</span>;
  };

  return (
    <div className="profile-container animate-fade-in">
      
      {/* Hero card */}
      <div className="profile-hero-card">
        <div className="profile-user-main">
          <div style={{ position: 'relative' }}>
            <img src={currentUser.avatar} alt={currentUser.name} className="profile-avatar-large" />
            <span
              style={{
                position: 'absolute',
                bottom: '4px',
                right: '4px',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                backgroundColor: isOnline ? '#10b981' : '#6b7280',
                border: '3px solid hsl(var(--bg-secondary))',
                boxShadow: '0 0 8px rgba(16, 185, 129, 0.4)'
              }}
              title={isOnline ? 'Сотрудник в сети (активное подключение)' : 'Не в сети'}
            />
          </div>
          <div className="profile-info-col">
            <div className="profile-name-row">
              <h1 className="profile-name">{currentUser.name}</h1>
              {getRoleBadge(currentUser.roleType)}
              <span style={{ fontSize: '0.8rem', padding: '2px 10px', borderRadius: '12px', background: isOnline ? 'rgba(16,185,129,0.15)' : 'rgba(107,114,128,0.15)', color: isOnline ? '#34d399' : '#9ca3af', fontWeight: 600 }}>
                {isOnline ? '🟢 В сети (Онлайн)' : '⚪ Оффлайн'}
              </span>
            </div>
            <div className="profile-role-dept">{currentUser.role} • {currentUser.department}</div>
            <div className="profile-email">📧 {currentUser.email}</div>
          </div>
        </div>

        <div className="profile-actions-col">
          <button
            className="btn-secondary"
            onClick={() => {
              setIsChangingPassword(!isChangingPassword);
              setIsEditing(false);
              setPwdMsg(null);
            }}
            style={{ borderColor: 'rgba(59, 130, 246, 0.4)', color: 'hsl(var(--primary))', fontWeight: 'bold' }}
          >
            🔐 Изменить пароль
          </button>
          <button
            className="btn-secondary"
            onClick={() => {
              setName(currentUser.name);
              setEmail(currentUser.email);
              setDepartment(currentUser.department);
              setAvatar(currentUser.avatar);
              setPin('');
              setIsEditing(!isEditing);
              setIsChangingPassword(false);
            }}
          >
            ✏️ {isEditing ? 'Отмена' : 'Редактировать профиль'}
          </button>
          <button
            className="btn-secondary"
            onClick={logout}
            style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171' }}
          >
            🚪 Выйти
          </button>
        </div>
      </div>

      {pwdMsg && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '10px',
          marginBottom: '16px',
          fontWeight: 600,
          background: pwdMsg.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          color: pwdMsg.type === 'success' ? '#22c55e' : '#ef4444',
          border: `1px solid ${pwdMsg.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
        }}>
          {pwdMsg.text}
        </div>
      )}

      {/* Quick Password Change Form */}
      {isChangingPassword && (
        <form className="profile-edit-form" onSubmit={handleQuickPasswordChange} style={{ marginBottom: '20px', borderLeft: '4px solid hsl(var(--primary))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '1.4rem' }}>🔐</span>
            <div>
              <h3 style={{ fontSize: '1.1rem', color: 'hsl(var(--primary))', margin: 0 }}>
                {currentUser.roleType === 'admin' ? 'Смена главного пароля Администратора' : 'Смена пароля входа'}
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'hsl(var(--text-secondary))', margin: 0 }}>
                {currentUser.roleType === 'admin'
                  ? 'Новый пароль будет сразу применен для учетной записи Администратора и сохранен в базе данных.'
                  : 'Новый пароль будет использоваться при следующем входе в систему.'}
              </p>
            </div>
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Новый пароль</label>
              <input
                type="password"
                className="input-field"
                placeholder="Введите новый пароль..."
                value={quickPassword}
                onChange={e => setQuickPassword(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Подтвердите пароль</label>
              <input
                type="password"
                className="input-field"
                placeholder="Повторите новый пароль..."
                value={quickPasswordConfirm}
                onChange={e => setQuickPasswordConfirm(e.target.value)}
                required
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button type="submit" className="btn-primary">
              💾 Сохранить новый пароль
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setIsChangingPassword(false);
                setQuickPassword('');
                setQuickPasswordConfirm('');
              }}
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      {/* Edit form */}
      {isEditing && (
        <form className="profile-edit-form" onSubmit={handleSaveProfile}>
          <h3 style={{ fontSize: '1.1rem', color: 'hsl(var(--primary))' }}>⚙️ Настройка личного профиля</h3>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">ФИО сотрудника</label>
              <input
                type="text"
                className="input-field"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Корпоративный Email</label>
              <input
                type="email"
                className="input-field"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Отдел / Направление</label>
              <input
                type="text"
                className="input-field"
                value={department}
                onChange={e => setDepartment(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Новый пароль / PIN-код (оставьте пустым, чтобы не менять)</label>
              <input
                type="text"
                className="input-field"
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="Оставьте пустым для сохранения текущего пароля"
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">URL фотографии или Загрузка с ПК</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                className="input-field"
                style={{ flex: 1 }}
                value={avatar}
                onChange={e => setAvatar(e.target.value)}
                placeholder="https://... или загрузите файл с компьютера"
              />
              <label className="file-upload-btn" style={{ padding: '10px 16px' }}>
                {isUploading ? '⌛ Загрузка...' : '📁 Загрузить с ПК'}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
              </label>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button type="button" className="btn-secondary" onClick={() => setIsEditing(false)}>
              Отмена
            </button>
            <button type="submit" className="btn-primary" disabled={isUploading}>
              💾 Сохранить изменения
            </button>
          </div>
        </form>
      )}

      {/* KPI Stats Grid */}
      <div className="profile-stats-grid">
        <div className="profile-stat-box">
          <span className="stat-box-label">🎯 Назначено задач</span>
          <span className="stat-box-value">{allMyTasks.length}</span>
          <span className="stat-box-sub">Лично: <strong>{myDirectTasks.length}</strong> • В командах: <strong>{myGroupTasks.length}</strong></span>
        </div>

        <div className="profile-stat-box">
          <span className="stat-box-label">✅ Выполнено задач</span>
          <span className="stat-box-value" style={{ color: '#10b981' }}>{completedTasks.length}</span>
          <span className="stat-box-sub">Успешность завершения: <strong>{completionRate}%</strong></span>
        </div>

        <div className="profile-stat-box">
          <span className="stat-box-label">⏳ Затрачено времени</span>
          <span className="stat-box-value" style={{ color: '#38bdf8' }}>{totalLoggedHours} ч</span>
          <span className="stat-box-sub">Оценка: {totalEstimatedHours} ч ({Math.round((totalLoggedHours / (totalEstimatedHours || 1)) * 100)}%)</span>
        </div>

        <div className="profile-stat-box">
          <span className="stat-box-label">⚡ Story Points</span>
          <span className="stat-box-value" style={{ color: '#c084fc' }}>{totalStoryPoints} SP</span>
          <span className="stat-box-sub">Суммарный вес моих задач</span>
        </div>
      </div>

      {/* My Tasks section */}
      <div className="profile-tasks-section">
        <div className="section-title-row">
          <h2 className="section-title">
            <span>📌</span> Мои назначенные задачи ({myDirectTasks.length})
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
            Нажмите на карточку, чтобы открыть детали или сдвинуть статус
          </span>
        </div>

        {myDirectTasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'hsl(var(--text-muted))' }}>
            У вас пока нет назначенных задач в этом проекте 🎉
          </div>
        ) : (
          <div className="my-tasks-grid">
            {myDirectTasks.map(t => (
              <div
                key={t.id}
                className="my-task-card"
                onClick={() => setActiveTaskModalId(t.id)}
              >
                <div className="my-task-header">
                  <span className="my-task-id">{t.id}</span>
                  <span className={`status-badge status-${t.status}`}>
                    {getStatusLabel(t.status)}
                  </span>
                </div>
                <div className="my-task-title">{t.title}</div>
                <div className="my-task-footer">
                  <span>Приоритет: <strong>{t.priority.toUpperCase()}</strong></span>
                  <span>⚡ {t.storyPoints} SP • ⏳ {t.loggedHours}/{t.estimatedHours} ч</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* My Group Tasks section */}
      {myGroupTasks.length > 0 && (
        <div className="profile-tasks-section" style={{ marginTop: '24px' }}>
          <div className="section-title-row">
            <h2 className="section-title">
              <span>🏢</span> Задачи моих команд / групп ({myGroupTasks.length})
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
              Задачи, назначенные на ваши отделы и доступные для выполнения
            </span>
          </div>

          <div className="my-tasks-grid">
            {myGroupTasks.map(t => {
              const grp = groups.find(g => g.id === t.assigneeGroupId);
              return (
                <div
                  key={t.id}
                  className="my-task-card"
                  onClick={() => setActiveTaskModalId(t.id)}
                  style={{ borderLeft: `4px solid ${grp?.color || '#3b82f6'}` }}
                >
                  <div className="my-task-header">
                    <span className="my-task-id">{t.id}</span>
                    <span className={`status-badge status-${t.status}`}>
                      {getStatusLabel(t.status)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: grp?.color || '#3b82f6', fontWeight: 700, marginBottom: '4px' }}>
                    🏢 Команда: {grp?.name}
                  </div>
                  <div className="my-task-title">{t.title}</div>
                  <div className="my-task-footer">
                    <span>Приоритет: <strong>{t.priority.toUpperCase()}</strong></span>
                    <span>⚡ {t.storyPoints} SP • ⏳ {t.loggedHours}/{t.estimatedHours} ч</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};
