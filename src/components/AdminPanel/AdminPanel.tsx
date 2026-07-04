import React, { useState } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import type { User, Group } from '../../types';
import { apiService } from '../../services/api';
import './AdminPanel.css';

export const AdminPanel: React.FC = () => {
  const { users, groups, addUser, updateUser, deleteUser, addGroup, updateGroup, deleteGroup } = useTaskContext();
  const { isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<'users' | 'groups'>('users');

  // User modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loginStr, setLoginStr] = useState('');
  const [passwordStr, setPasswordStr] = useState('1234');
  const [department, setDepartment] = useState('Engineering');
  const [roleTitle, setRoleTitle] = useState('Developer');
  const [roleType, setRoleType] = useState<'admin' | 'manager' | 'member'>('member');
  const [pin, setPin] = useState('1234');
  const [avatar, setAvatar] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Group modal states
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupColor, setGroupColor] = useState('#3b82f6');
  const [groupMembers, setGroupMembers] = useState<string[]>([]);

  // Password reveal confirmation states
  const [revealedUsers, setRevealedUsers] = useState<Record<string, boolean>>({});

  if (!isAdmin) {
    return (
      <div className="admin-panel-container" style={{ textAlign: 'center', padding: '80px 20px' }}>
        <h2 style={{ color: '#ef4444', fontSize: '1.8rem' }}>🚫 Доступ запрещен</h2>
        <p style={{ color: 'hsl(var(--text-secondary))', marginTop: '12px' }}>
          Управление пользователями и правами доступа разрешено только Администраторам системы.
        </p>
      </div>
    );
  }

  // --- USER HANDLERS ---
  const handleOpenAddModal = () => {
    setEditingUser(null);
    setName('');
    setEmail('');
    setLoginStr('');
    setPasswordStr('1234');
    setDepartment('Engineering');
    setRoleTitle('Specialist');
    setRoleType('member');
    setPin('1234');
    setAvatar('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: User) => {
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setLoginStr(user.login || user.email?.split('@')[0] || '');
    setPasswordStr(user.password || user.pin || '1234');
    setDepartment(user.department);
    setRoleTitle(user.role);
    setRoleType(user.roleType || 'member');
    setPin(user.pin || '1234');
    setAvatar(user.avatar);
    setIsModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    const finalLogin = loginStr.trim() || email.split('@')[0] || `user_${Date.now()}`;
    const finalPass = passwordStr.trim() || pin.trim() || '1234';

    if (editingUser) {
      updateUser(editingUser.id, {
        name: name.trim(),
        email: email.trim(),
        login: finalLogin,
        password: finalPass,
        department: department.trim(),
        role: roleTitle.trim(),
        roleType,
        pin: finalPass,
        avatar: avatar.trim() || editingUser.avatar
      });
    } else {
      addUser({
        name: name.trim(),
        email: email.trim() || `${name.toLowerCase().replace(/\s+/g, '.')}@corp.lan`,
        login: finalLogin,
        password: finalPass,
        department: department.trim(),
        role: roleTitle.trim(),
        roleType,
        pin: finalPass,
        avatar: avatar.trim() || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        isActive: true
      });
    }
    setIsModalOpen(false);
  };

  const handleToggleActive = (user: User) => {
    if (user.isActive === false) {
      updateUser(user.id, { isActive: true });
    } else {
      deleteUser(user.id, false);
    }
  };

  const handleDeletePermanent = (user: User) => {
    deleteUser(user.id, true);
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

  // --- GROUP HANDLERS ---
  const handleOpenAddGroupModal = () => {
    setEditingGroup(null);
    setGroupName('');
    setGroupColor('#3b82f6');
    setGroupMembers([]);
    setIsGroupModalOpen(true);
  };

  const handleOpenEditGroupModal = (grp: Group) => {
    setEditingGroup(grp);
    setGroupName(grp.name);
    setGroupColor(grp.color || '#3b82f6');
    setGroupMembers(grp.memberIds || []);
    setIsGroupModalOpen(true);
  };

  const handleSaveGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingGroup) {
      updateGroup(editingGroup.id, {
        name: groupName.trim(),
        color: groupColor,
        memberIds: groupMembers
      });
    } else {
      addGroup({
        name: groupName.trim(),
        color: groupColor,
        memberIds: groupMembers
      });
    }
    setIsGroupModalOpen(false);
  };

  const handleDeleteGroupClick = (grp: Group) => {
    if (window.confirm(`Вы уверены, что хотите удалить команду «${grp.name}»?`)) {
      deleteGroup(grp.id);
    }
  };

  const toggleGroupMember = (userId: string) => {
    if (groupMembers.includes(userId)) {
      setGroupMembers(prev => prev.filter(id => id !== userId));
    } else {
      setGroupMembers(prev => [...prev, userId]);
    }
  };

  // --- PASSWORD REVEAL HANDLERS ---
  const handleToggleReveal = (userId: string) => {
    setRevealedUsers(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const getRoleBadge = (type?: string) => {
    if (type === 'admin') return <span className="role-badge-mini role-admin">Администратор</span>;
    if (type === 'manager') return <span className="role-badge-mini role-manager">Руководитель</span>;
    return <span className="role-badge-mini role-member">Сотрудник</span>;
  };

  return (
    <div className="admin-panel-container animate-fade-in">
      
      {/* Header */}
      <div className="admin-header-card">
        <div className="admin-header-title">
          <h1 className="admin-title-text">
            <span>⚙️</span> Администрирование и Ролевой доступ (RBAC)
          </h1>
          <p className="admin-subtitle">
            Управление персоналом и командами корпорации
          </p>
          <div className="admin-tabs">
            <button
              className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              👥 Сотрудники ({users.length} / 15)
            </button>
            <button
              className={`admin-tab-btn ${activeTab === 'groups' ? 'active' : ''}`}
              onClick={() => setActiveTab('groups')}
            >
              🏢 Команды и Группы ({groups.length})
            </button>
          </div>
        </div>

        {activeTab === 'users' ? (
          <button className="btn-primary" onClick={handleOpenAddModal}>
            ➕ Добавить нового сотрудника
          </button>
        ) : (
          <button className="btn-primary" onClick={handleOpenAddGroupModal}>
            ➕ Создать команду / группу
          </button>
        )}
      </div>

      {/* Table: USERS */}
      {activeTab === 'users' && (
        <div className="admin-table-card">
          <div className="table-responsive-wrapper">
            <table className="users-admin-table">
              <thead>
                <tr>
                  <th>Сотрудник</th>
                  <th>Логин (учетка)</th>
                  <th>Должность</th>
                  <th>Отдел</th>
                  <th>Уровень прав</th>
                  <th>Пароль / PIN</th>
                  <th>Статус</th>
                  <th style={{ textAlign: 'right' }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const isInactive = u.isActive === false;
                  const isRevealed = !!revealedUsers[u.id];
                  const secret = u.password || u.pin || '1234';
                  return (
                    <tr key={u.id} className={isInactive ? 'user-disabled' : ''}>
                      <td>
                        <div className="admin-user-cell">
                          <img src={u.avatar} alt={u.name} className="admin-user-avatar" />
                          <div className="admin-user-details">
                            <span className="admin-user-name">{u.name}</span>
                            <span className="admin-user-email">{u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <code style={{ background: 'rgba(99,102,241,0.12)', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', color: 'hsl(var(--primary))' }}>
                          {u.login || u.email?.split('@')[0]}
                        </code>
                      </td>
                      <td>{u.role}</td>
                      <td>{u.department}</td>
                      <td>{getRoleBadge(u.roleType)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="pin-code-badge">
                            {isRevealed ? secret : '••••'}
                          </span>
                          <button
                            type="button"
                            className="reveal-btn"
                            onClick={() => handleToggleReveal(u.id)}
                            title={isRevealed ? 'Скрыть' : 'Показать пароль (требуется пароль админа)'}
                          >
                            {isRevealed ? '🙈' : '👁️'}
                          </button>
                        </div>
                      </td>
                      <td>
                        {isInactive ? (
                          <span className="status-indicator-pill status-inactive">⛔ Заблокирован</span>
                        ) : (
                          <span className="status-indicator-pill status-active">🟢 Активен</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="action-buttons-row" style={{ justifyItems: 'end', justifyContent: 'flex-end' }}>
                          <button
                            className="btn-icon-mini"
                            onClick={() => handleOpenEditModal(u)}
                            title="Редактировать сотрудника"
                          >
                            ✏️ Изменить
                          </button>
                          <button
                            className={`btn-icon-mini ${isInactive ? '' : 'btn-icon-danger'}`}
                            onClick={() => handleToggleActive(u)}
                            title={isInactive ? 'Разблокировать аккаунт' : 'Заблокировать аккаунт'}
                          >
                            {isInactive ? '🔓 Разблокировать' : '🚫 Блокировать'}
                          </button>
                          <button
                            className="btn-icon-mini btn-icon-danger"
                            onClick={() => handleDeletePermanent(u)}
                            title="Удалить пользователя из базы данных навсегда"
                            style={{ color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)' }}
                          >
                            🗑️ Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Table: GROUPS */}
      {activeTab === 'groups' && (
        <div className="admin-table-card">
          <div className="table-responsive-wrapper">
            <table className="users-admin-table">
              <thead>
                <tr>
                  <th>Команда / Группа</th>
                  <th>Цвет</th>
                  <th>Количество участников</th>
                  <th>Сотрудники</th>
                  <th style={{ textAlign: 'right' }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(g => {
                  const memberUsers = users.filter(u => g.memberIds.includes(u.id));
                  return (
                    <tr key={g.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', fontSize: '1rem' }}>
                          <span className="group-color-dot" style={{ backgroundColor: g.color || '#3b82f6' }} />
                          {g.name}
                        </div>
                      </td>
                      <td>
                        <code style={{ color: g.color || '#3b82f6', fontWeight: 'bold' }}>{g.color || '#3b82f6'}</code>
                      </td>
                      <td>
                        <strong style={{ fontSize: '1.1rem', color: 'hsl(var(--primary))' }}>{g.memberIds.length}</strong> чел.
                      </td>
                      <td>
                        <div className="group-members-list">
                          {memberUsers.map(mu => (
                            <span key={mu.id} className="group-member-pill">
                              <img src={mu.avatar} alt="" style={{ width: '16px', height: '16px', borderRadius: '50%' }} />
                              {mu.name.split(' ')[0]}
                            </span>
                          ))}
                          {memberUsers.length === 0 && <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.8rem' }}>Нет участников</span>}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="action-buttons-row" style={{ justifyItems: 'end', justifyContent: 'flex-end' }}>
                          <button className="btn-icon-mini" onClick={() => handleOpenEditGroupModal(g)}>
                            ✏️ Изменить
                          </button>
                          <button className="btn-icon-mini btn-icon-danger" onClick={() => handleDeleteGroupClick(g)}>
                            🗑️ Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit USER Modal */}
      {isModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="admin-modal-card" onClick={e => e.stopPropagation()}>
            <h2 className="admin-modal-title">
              {editingUser ? '✏️ Редактирование сотрудника' : '➕ Добавление нового сотрудника'}
            </h2>

            <form onSubmit={handleSaveUser} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">ФИО сотрудника</label>
                  <input
                    type="text"
                    className="input-field"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Например: Иван Иванов"
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
                    placeholder="i.ivanov@corp.lan"
                    required
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Логин (имя учетной записи)</label>
                  <input
                    type="text"
                    className="input-field"
                    value={loginStr}
                    onChange={e => setLoginStr(e.target.value)}
                    placeholder="Например: iivanov"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Пароль для входа</label>
                  <input
                    type="text"
                    className="input-field"
                    value={passwordStr}
                    onChange={e => setPasswordStr(e.target.value)}
                    placeholder="1234"
                    required
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Название должности</label>
                  <input
                    type="text"
                    className="input-field"
                    value={roleTitle}
                    onChange={e => setRoleTitle(e.target.value)}
                    placeholder="Например: Frontend Developer"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Отдел</label>
                  <input
                    type="text"
                    className="input-field"
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    placeholder="Engineering / Design / QA"
                    required
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Уровень прав (Роль в системе)</label>
                  <select
                    className="input-field select-field"
                    value={roleType}
                    onChange={e => setRoleType(e.target.value as any)}
                  >
                    <option value="member">Сотрудник (Member) — только свои задачи</option>
                    <option value="manager">Руководитель (Manager) — управление спринтами и задачами</option>
                    <option value="admin">Администратор (Admin) — полный доступ и админка</option>
                  </select>
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
                      placeholder="https://... или загрузите файл"
                    />
                    <label className="file-upload-btn">
                      {isUploading ? '⌛ Загрузка...' : '📁 С ПК'}
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
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Отмена
                </button>
                <button type="submit" className="btn-primary" disabled={isUploading}>
                  💾 {editingUser ? 'Сохранить изменения' : 'Создать аккаунт'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit GROUP Modal */}
      {isGroupModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setIsGroupModalOpen(false)}>
          <div className="admin-modal-card" onClick={e => e.stopPropagation()}>
            <h2 className="admin-modal-title">
              {editingGroup ? '✏️ Редактирование команды / группы' : '➕ Создание новой команды'}
            </h2>

            <form onSubmit={handleSaveGroup} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Название команды</label>
                  <input
                    type="text"
                    className="input-field"
                    value={groupName}
                    onChange={e => setGroupName(e.target.value)}
                    placeholder="Например: 🚀 Команда Разработки"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Цвет метки команды</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={groupColor}
                      onChange={e => setGroupColor(e.target.value)}
                      style={{ width: '44px', height: '40px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      className="input-field"
                      style={{ flex: 1 }}
                      value={groupColor}
                      onChange={e => setGroupColor(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Участники команды ({groupMembers.length} выбр.)</label>
                <div className="group-checkbox-grid">
                  {users.map(u => {
                    const checked = groupMembers.includes(u.id);
                    return (
                      <label key={u.id} className="group-checkbox-item">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleGroupMember(u.id)}
                        />
                        <img src={u.avatar} alt="" style={{ width: '20px', height: '20px', borderRadius: '50%' }} />
                        <span>{u.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsGroupModalOpen(false)}>
                  Отмена
                </button>
                <button type="submit" className="btn-primary">
                  💾 {editingGroup ? 'Сохранить команду' : 'Создать команду'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
