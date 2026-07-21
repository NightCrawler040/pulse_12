import React, { useState } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import type { User, Group } from '../../types';
import { apiService } from '../../services/api';
import './AdminPanel.css';

export const AdminPanel: React.FC = () => {
  const { users, groups, onlineUserIds, apiKeys, addUser, updateUser, deleteUser, addGroup, updateGroup, deleteGroup, addApiKey, deleteApiKey } = useTaskContext();
  const { isAdmin } = useAuth();
  const isProtectedAdmin = (u: User) => u.id === 'usr-1' || u.login?.toLowerCase() === 'admin';
  const employeeUsers = users.filter(u => !isProtectedAdmin(u));

  const [activeTab, setActiveTab] = useState<'users' | 'groups' | 'integrations'>('users');
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeySource, setNewKeySource] = useState<'derscanner' | 'siem' | 'custom'>('derscanner');
  const [newKeyAllowedDepts, setNewKeyAllowedDepts] = useState<string[]>(['all']);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  // Group modal states
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupColor, setGroupColor] = useState('#3b82f6');
  const [groupMembers, setGroupMembers] = useState<string[]>([]);

  // Password reveal confirmation states
  const [revealedUsers, setRevealedUsers] = useState<Record<string, boolean>>({});

  // Bulk selection and confirmation modal states
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    type: 'single' | 'bulk';
    targetUser?: User;
  }>({ isOpen: false, type: 'single' });


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

  const DEFAULT_AVATAR = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2364748b"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';

  // --- USER HANDLERS ---
  const handleOpenAddModal = () => {
    setEditingUser(null);
    setErrorMessage(null);
    setName('');
    setEmail('');
    setLoginStr('');
    setPasswordStr('1234');
    setDepartment('Engineering');
    setRoleTitle('Specialist');
    setRoleType('member');
    setPin('1234');
    setAvatar('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: User) => {
    setEditingUser(user);
    setErrorMessage(null);
    setName(user.name);
    setEmail(user.email);
    setLoginStr(user.login || user.email?.split('@')[0] || '');
    setPasswordStr(user.password || user.pin || '1234');
    setDepartment(user.department);
    setRoleTitle(user.role);
    setRoleType(user.roleType || 'member');
    setPin('');
    setPasswordStr('');
    setAvatar(user.avatar);
    setIsModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    const finalLogin = (loginStr.trim() || email.split('@')[0] || `user_${Date.now()}`).toLowerCase();

    // Проверка на дублирование почты или логина (кроме редактируемого сотрудника)
    const duplicateUser = users.find(u => {
      if (editingUser && u.id === editingUser.id) return false;
      const uEmail = (u.email || '').trim().toLowerCase();
      const uLogin = (u.login || uEmail.split('@')[0] || '').trim().toLowerCase();
      return (trimmedEmail && uEmail === trimmedEmail) || (finalLogin && uLogin === finalLogin);
    });

    if (duplicateUser) {
      setErrorMessage(`⚠️ Ошибка: Сотрудник с почтой «${email}» или логином «${loginStr || finalLogin}» уже существует (${duplicateUser.name})! Укажите уникальные данные.`);
      return;
    }
    setErrorMessage(null);

    const typedPass = passwordStr.trim() || pin.trim();

    if (editingUser) {
      const updates: Partial<User> = {
        name: name.trim(),
        email: email.trim(),
        login: finalLogin,
        department: department.trim(),
        role: roleTitle.trim(),
        roleType,
        avatar: avatar.trim() || editingUser.avatar
      };
      if (typedPass) {
        updates.password = typedPass;
        updates.pin = typedPass;
      }
      updateUser(editingUser.id, updates);
    } else {
      addUser({
        name: name.trim(),
        email: email.trim() || `${name.toLowerCase().replace(/\s+/g, '.')}@corp.lan`,
        login: finalLogin,
        password: typedPass || '',
        department: department.trim(),
        role: roleTitle.trim(),
        roleType,
        pin: typedPass || '',
        avatar: avatar.trim() || DEFAULT_AVATAR,
        isActive: true
      });
    }
    setIsModalOpen(false);
  };

  const filteredUsers = employeeUsers.filter(u => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      u.name.toLowerCase().includes(q) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.login && u.login.toLowerCase().includes(q)) ||
      u.role.toLowerCase().includes(q) ||
      u.department.toLowerCase().includes(q);
    const matchesDept = !deptFilter || u.department === deptFilter;
    return matchesSearch && matchesDept;
  });

  const handleExportCSV = () => {
    const headers = ['ID', 'ФИО', 'Email', 'Логин', 'Отдел', 'Должность', 'Уровень прав', 'PIN / Пароль', 'Статус'];
    const rows = employeeUsers.map(u => [
      u.id,
      `"${u.name}"`,
      `"${u.email}"`,
      `"${u.login || ''}"`,
      `"${u.department}"`,
      `"${u.role}"`,
      u.roleType || 'member',
      `"${u.pin || u.password || ''}"`,
      u.isActive === false ? 'Заблокирован' : 'Активен'
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `pulse12_users_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleToggleActive = (user: User) => {
    if (user.isActive === false) {
      updateUser(user.id, { isActive: true });
    } else {
      deleteUser(user.id, false);
    }
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
              👥 Сотрудники ({employeeUsers.length} / 15)
            </button>
            <button
              className={`admin-tab-btn ${activeTab === 'groups' ? 'active' : ''}`}
              onClick={() => setActiveTab('groups')}
            >
              🏢 Команды и Группы ({groups.length})
            </button>
            <button
              className={`admin-tab-btn ${activeTab === 'integrations' ? 'active' : ''}`}
              onClick={() => setActiveTab('integrations')}
            >
              🔌 Интеграции & API-ключи ({apiKeys.length})
            </button>
          </div>
        </div>

        {activeTab === 'users' ? (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn-secondary"
              style={{ background: 'hsl(var(--bg-secondary))', border: '1px solid hsl(var(--border-color))', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={handleExportCSV}
              title="Экспорт списка сотрудников в Excel / CSV"
            >
              📥 Экспорт в CSV
            </button>
            <button
              className="btn-secondary"
              style={{ background: 'rgba(59,132,246,0.15)', border: '1px solid rgba(59,132,246,0.4)', color: 'hsl(var(--primary))', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
              onClick={() => { setActiveTab('groups'); handleOpenAddGroupModal(); }}
            >
              🏢 + Создать команду / объединить людей
            </button>
            {selectedUserIds.length > 0 && (
              <button
                className="btn-secondary"
                style={{ background: '#ef4444', color: 'white', border: 'none', fontWeight: 'bold' }}
                onClick={() => setDeleteConfirmModal({ isOpen: true, type: 'bulk' })}
              >
                🗑️ Удалить выбранных ({selectedUserIds.length})
              </button>
            )}
            <button className="btn-primary" onClick={handleOpenAddModal}>
              ➕ Добавить нового сотрудника
            </button>
          </div>
        ) : activeTab === 'groups' ? (
          <button className="btn-primary" onClick={handleOpenAddGroupModal}>
            ➕ Создать команду / группу
          </button>
        ) : (
          <button className="btn-primary" onClick={() => { setNewKeyName(''); setIsKeyModalOpen(true); }}>
            ➕ Сгенерировать API-ключ
          </button>
        )}
      </div>

      {/* Table: USERS */}
      {activeTab === 'users' && (
        <>
          <div style={{
            background: 'hsl(var(--bg-secondary))',
            border: '1px solid hsl(var(--border-color))',
            borderRadius: '12px',
            padding: '14px 18px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '1.6rem' }}>👑</span>
              <div>
                <strong style={{ display: 'block', color: 'hsl(var(--text-primary))', fontSize: '1.02rem' }}>
                  Учетная запись Администратора скрыта из общего списка сотрудников
                </strong>
                <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>
                  Смена пароля Администратора осуществляется в <b>Личном кабинете</b> (нажмите на свой профиль в правом верхнем углу → «🔐 Изменить пароль»).
                </span>
              </div>
            </div>
          </div>

          <div className="admin-table-card">
          <div style={{ display: 'flex', gap: '12px', padding: '16px 20px', borderBottom: '1px solid hsl(var(--border-color))', flexWrap: 'wrap', alignItems: 'center', background: 'hsl(var(--bg-secondary))' }}>
            <div style={{ flex: '1 1 250px', position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: '12px', fontSize: '1.1rem', color: 'hsl(var(--text-secondary))' }}>🔍</span>
              <input
                type="text"
                className="input-field"
                style={{ paddingLeft: '38px', margin: 0, width: '100%', borderRadius: '8px', background: 'hsl(var(--bg-card))' }}
                placeholder="Быстрый поиск по ФИО, логину, почте или должности..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="input-field"
              style={{ width: 'auto', margin: 0, borderRadius: '8px', cursor: 'pointer', minWidth: '180px', background: 'hsl(var(--bg-card))' }}
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
            >
              <option value="">🏢 Все отделы ({employeeUsers.length})</option>
              {Array.from(new Set(employeeUsers.map(u => u.department))).filter(Boolean).map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            {(searchQuery || deptFilter) && (
              <button
                className="btn-secondary"
                style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                onClick={() => { setSearchQuery(''); setDeptFilter(''); }}
              >
                ❌ Сбросить ({filteredUsers.length})
              </button>
            )}
          </div>
          <div className="table-responsive-wrapper">
            <table className="users-admin-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={filteredUsers.filter(u => !isProtectedAdmin(u)).length > 0 && filteredUsers.filter(u => !isProtectedAdmin(u)).every(u => selectedUserIds.includes(u.id))}
                      onChange={() => {
                        const selectable = filteredUsers.filter(u => !isProtectedAdmin(u));
                        if (selectable.every(u => selectedUserIds.includes(u.id))) {
                          setSelectedUserIds(prev => prev.filter(id => !selectable.some(s => s.id === id)));
                        } else {
                          setSelectedUserIds(prev => Array.from(new Set([...prev, ...selectable.map(s => s.id)])));
                        }
                      }}
                      title="Выбрать всех (кроме главного администратора)"
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                  </th>
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
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'hsl(var(--text-secondary))' }}>
                      🔍 Сотрудники не найдены. Попробуйте изменить параметры поиска или фильтрации.
                    </td>
                  </tr>
                ) : (
                filteredUsers.map(u => {
                  const isInactive = u.isActive === false;
                  const isRevealed = !!revealedUsers[u.id];
                  const secret = u.password || u.pin || '1234';
                  const isProtected = isProtectedAdmin(u);
                  return (
                    <tr key={u.id} className={isInactive ? 'user-disabled' : ''}>
                      <td style={{ textAlign: 'center' }}>
                        {isProtected ? (
                          <span title="Главный администратор защищен от удаления" style={{ fontSize: '1rem', cursor: 'not-allowed' }}>👑</span>
                        ) : (
                          <input
                            type="checkbox"
                            checked={selectedUserIds.includes(u.id)}
                            onChange={() => {
                              setSelectedUserIds(prev =>
                                prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]
                              );
                            }}
                            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                          />
                        )}
                      </td>
                      <td>
                        <div className="admin-user-cell">
                          <img src={u.avatar} alt={u.name} className="admin-user-avatar" />
                          <div className="admin-user-details">
                            <span className="admin-user-name">{u.name} {isProtected && <span style={{ color: '#f59e0b', fontSize: '0.8rem' }}>(Главный админ)</span>}</span>
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {onlineUserIds?.includes(u.id) ? (
                            <span className="status-indicator-pill status-active" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', width: 'fit-content', padding: '3px 8px', fontSize: '0.75rem', fontWeight: 600 }}>🟢 В сети (Онлайн)</span>
                          ) : (
                            <span className="status-indicator-pill" style={{ background: 'rgba(107, 114, 128, 0.15)', color: '#9ca3af', width: 'fit-content', padding: '3px 8px', fontSize: '0.75rem', fontWeight: 600 }}>⚪ Оффлайн</span>
                          )}
                          {isInactive ? (
                            <span className="status-indicator-pill status-inactive" style={{ width: 'fit-content', padding: '2px 6px', fontSize: '0.7rem' }}>⛔ Заблокирован</span>
                          ) : (
                            <span className="status-indicator-pill status-active" style={{ width: 'fit-content', padding: '2px 6px', fontSize: '0.7rem', opacity: 0.8 }}>✔ Активная учетка</span>
                          )}
                        </div>
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
                          {isProtected ? (
                            <span style={{ color: '#94a3b8', fontSize: '0.8rem', padding: '4px 8px', background: 'rgba(148,163,184,0.1)', borderRadius: '4px', border: '1px solid rgba(148,163,184,0.2)' }}>
                              👑 Защищен
                            </span>
                          ) : (
                            <button
                              className="btn-icon-mini btn-icon-danger"
                              onClick={() => setDeleteConfirmModal({ isOpen: true, type: 'single', targetUser: u })}
                              title="Удалить пользователя из базы данных навсегда"
                              style={{ color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)' }}
                            >
                              🗑️ Удалить
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>
        </div>
        </>
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

      {/* Table & Management: INTEGRATIONS & API KEYS */}
      {activeTab === 'integrations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{
            background: 'hsl(var(--bg-secondary))',
            border: '1px solid hsl(var(--border-color))',
            borderRadius: '12px',
            padding: '18px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '2rem' }}>🛡️</span>
              <div>
                <strong style={{ fontSize: '1.15rem', color: 'hsl(var(--text-primary))', display: 'block' }}>
                  Интеграция со сканерами безопасности (DerScanner, SAST/DAST) и SIEM
                </strong>
                <span style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))' }}>
                  Настройте автоматический прием тикетов и алертов об уязвимостях в Центр Инцидентов ИБ через защищенный REST Webhook.
                </span>
              </div>
            </div>
            <div style={{
              background: 'rgba(59, 130, 246, 0.1)',
              borderLeft: '4px solid hsl(var(--primary))',
              padding: '12px 16px',
              borderRadius: '6px',
              fontSize: '0.88rem',
              fontFamily: 'monospace',
              color: 'hsl(var(--text-primary))',
              lineHeight: '1.5',
              wordBreak: 'break-all'
            }}>
              <div><strong>🌐 Webhook Endpoint URL:</strong> <code>http://&lt;IP-ВАШЕГО-СЕРВЕРА&gt;:3001/api/v1/webhooks/derscanner</code></div>
              <div style={{ marginTop: '6px' }}><strong>🔑 Заголовок авторизации:</strong> <code>X-API-Key: &lt;ВАШ_СГЕНЕРИРОВАННЫЙ_КЛЮЧ&gt;</code></div>
              <div style={{ marginTop: '6px', color: 'hsl(var(--text-secondary))' }}>
                <em>Пример cURL запроса для проверки DerScanner:</em><br />
                <code>{`curl -X POST http://localhost:3001/api/v1/webhooks/derscanner -H "X-API-Key: ds-live-8f92a4c17e3b9012d45a" -H "Content-Type: application/json" -d '{"source":"derscanner","title":"SQL Injection in LoginController","severity":"Critical","project":"Pulse12 Corporate","fileLocation":"AuthController.java:142","cwe":"CWE-89"}'`}</code>
              </div>
            </div>
            <div style={{
              background: 'rgba(249, 115, 22, 0.1)',
              borderLeft: '4px solid #f97316',
              padding: '14px 18px',
              borderRadius: '6px',
              fontSize: '0.9rem',
              color: 'hsl(var(--text-primary))',
              lineHeight: '1.5',
              marginTop: '12px'
            }}>
              <strong style={{ display: 'block', marginBottom: '6px', color: '#f97316', fontSize: '1rem' }}>
                💡 Настройка подключения в интерфейсе реального DerScanner (Аккаунт &gt; Доступы &gt; Таск-менеджер / Jira):
              </strong>
              <span>
                При интеграции внешнего сканера (DerScanner / SIEM) через настройки подключения из скриншота укажите параметры:
              </span>
              <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
                <li style={{ marginBottom: '4px' }}><strong>URL сервера (Jira / Webhook):</strong> <code>http://&lt;IP-ВАШЕГО-СЕРВЕРА&gt;:3001/api/v1/webhooks/derscanner</code></li>
                <li style={{ marginBottom: '4px' }}><strong>Логин Jira (или Токен доступа):</strong> вставьте сгенерированный ключ <code>ds-live-...</code> (или передавайте в заголовке <code>X-API-Key</code>)</li>
                <li><strong>Пароль Jira:</strong> можно указать <code>webhook-token</code> (или оставить пустым, если система разрешает)</li>
              </ul>
            </div>
          </div>

          <div className="admin-table-card">
            <div className="table-responsive-wrapper">
              <table className="users-admin-table">
                <thead>
                  <tr>
                    <th>Название ключа / Системы</th>
                    <th>Тип сканера</th>
                    <th>Секретный токен (X-API-Key)</th>
                    <th>Доступ (Отделы)</th>
                    <th>Дата создания</th>
                    <th>Последняя активность</th>
                    <th style={{ textAlign: 'right' }}>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map(k => (
                    <tr key={k.id}>
                      <td>
                        <strong style={{ fontSize: '1rem', color: 'hsl(var(--text-primary))' }}>{k.name}</strong>
                      </td>
                      <td>
                        <span className="badge-pill" style={{
                          background: k.source === 'derscanner' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                          color: k.source === 'derscanner' ? '#ef4444' : '#3b82f6',
                          fontWeight: 'bold',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '0.8rem'
                        }}>
                          {k.source === 'derscanner' ? '🛡️ DerScanner SAST' : k.source === 'siem' ? '🚨 SIEM Monitor' : '🔌 Custom API'}
                        </span>
                      </td>
                      <td>
                        <code style={{ background: 'hsl(var(--bg-secondary))', padding: '4px 8px', borderRadius: '4px', fontSize: '0.88rem', color: 'hsl(var(--primary))' }}>
                          {k.key}
                        </code>
                      </td>
                      <td>
                        {(!k.allowedDepartments || k.allowedDepartments.includes('all')) ? (
                          <span style={{ fontSize: '0.82rem', background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
                            👥 Все отделы
                          </span>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {k.allowedDepartments.map(dept => (
                              <span key={dept} style={{ fontSize: '0.75rem', background: 'rgba(99, 102, 241, 0.15)', color: 'hsl(var(--primary))', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                {dept}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: '0.88rem', color: 'hsl(var(--text-secondary))' }}>
                        {new Date(k.createdAt).toLocaleDateString('ru-RU')}
                      </td>
                      <td style={{ fontSize: '0.88rem', color: k.lastUsedAt ? '#22c55e' : 'hsl(var(--text-muted))', fontWeight: k.lastUsedAt ? 600 : 400 }}>
                        {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString('ru-RU') : 'Ещё не использовался'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn-icon-mini btn-icon-danger"
                          onClick={() => {
                            if (window.confirm(`Отзыв ключа "${k.name}" приведет к остановке приема инцидентов из этой системы. Продолжить?`)) {
                              deleteApiKey(k.id);
                            }
                          }}
                        >
                          🗑️ Отозвать
                        </button>
                      </td>
                    </tr>
                  ))}
                  {apiKeys.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'hsl(var(--text-muted))' }}>
                        API-ключи еще не созданы. Нажмите «➕ Сгенерировать API-ключ» для подключения DerScanner.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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

            {errorMessage && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#f87171', padding: '12px 16px', borderRadius: '8px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, marginBottom: '8px' }}>
                <span>🚫</span>
                <span>{errorMessage}</span>
              </div>
            )}

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
                  <label className="form-label">
                    {editingUser ? 'Новый пароль (оставьте пустым для сохранения)' : 'Пароль для входа'}
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={passwordStr}
                    onChange={e => setPasswordStr(e.target.value)}
                    placeholder={editingUser ? 'Не менять текущий пароль' : '1234'}
                    required={!editingUser}
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
                  {employeeUsers.map(u => {
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

      {/* Confirmation Modal for User Deletion */}
      {deleteConfirmModal.isOpen && (
        <div className="modal-overlay" style={{ zIndex: 3000 }}>
          <div className="modal-content animate-scale-up" style={{ maxWidth: '440px', textAlign: 'center', padding: '24px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>⚠️</div>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '12px', color: '#ef4444' }}>
              Подтверждение удаления
            </h3>
            <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: '20px', lineHeight: '1.5' }}>
              {deleteConfirmModal.type === 'single'
                ? `Вы действительно хотите безвозвратно удалить сотрудника «${deleteConfirmModal.targetUser?.name}»? Все его задачи будут переведены в статус "Не назначен".`
                : `Вы действительно хотите безвозвратно удалить выбранных сотрудников (${selectedUserIds.length} чел.)? Это действие невозможно отменить.`}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDeleteConfirmModal({ isOpen: false, type: 'single' })}
              >
                Отмена
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ background: '#ef4444', border: 'none', fontWeight: 'bold' }}
                onClick={() => {
                  if (deleteConfirmModal.type === 'single' && deleteConfirmModal.targetUser) {
                    deleteUser(deleteConfirmModal.targetUser.id, true);
                  } else if (deleteConfirmModal.type === 'bulk') {
                    selectedUserIds.forEach(id => {
                      const target = users.find(u => u.id === id);
                      if (target && !isProtectedAdmin(target)) {
                        deleteUser(id, true);
                      }
                    });
                    setSelectedUserIds([]);
                  }
                  setDeleteConfirmModal({ isOpen: false, type: 'single' });
                }}
              >
                🗑️ Да, удалить безвозвратно
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for API Key Generation */}
      {isKeyModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setIsKeyModalOpen(false)}>
          <div className="admin-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <h2 className="admin-modal-title">🔑 Генерация нового API-ключа</h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!newKeyName.trim()) return;
              await addApiKey(newKeyName, newKeySource, newKeyAllowedDepts);
              setIsKeyModalOpen(false);
              setNewKeyName('');
              setNewKeyAllowedDepts(['all']);
            }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Название интеграции / сканера</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Например: DerScanner Production Scanner"
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Тип внешней системы</label>
                <select
                  className="input-field"
                  value={newKeySource}
                  onChange={e => setNewKeySource(e.target.value as any)}
                >
                  <option value="derscanner">🛡️ DerScanner SAST (Анализ кода на уязвимости)</option>
                  <option value="siem">🚨 SIEM Monitor (Мониторинг безопасности)</option>
                  <option value="custom">🔌 Custom Webhook / API</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Доступ к уведомлениям и алертам для отделов:</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'hsl(var(--bg-secondary))', padding: '10px 12px', borderRadius: '8px', border: '1px solid hsl(var(--border-color))' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', cursor: 'pointer', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={newKeyAllowedDepts.includes('all')}
                      onChange={e => {
                        if (e.target.checked) setNewKeyAllowedDepts(['all']);
                        else setNewKeyAllowedDepts(['Engineering', 'Security']);
                      }}
                    />
                    <span>👥 Все отделы (Общий доступ)</span>
                  </label>
                  {!newKeyAllowedDepts.includes('all') && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '4px', paddingLeft: '16px', borderLeft: '2px solid hsl(var(--primary))' }}>
                      {['Engineering', 'Security', 'DevOps', 'QA Engineering', 'Product & Agile'].map(dept => (
                        <label key={dept} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={newKeyAllowedDepts.includes(dept)}
                            onChange={e => {
                              if (e.target.checked) setNewKeyAllowedDepts(prev => [...prev, dept]);
                              else setNewKeyAllowedDepts(prev => prev.filter(d => d !== dept));
                            }}
                          />
                          <span>{dept}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsKeyModalOpen(false)}>
                  Отмена
                </button>
                <button type="submit" className="btn-primary">
                  ✨ Сгенерировать ключ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
