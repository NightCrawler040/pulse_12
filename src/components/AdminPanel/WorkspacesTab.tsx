import React, { useState, useMemo } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { apiService } from '../../services/api';
import type { Workspace } from '../../types';

export const WorkspacesTab: React.FC = () => {
  const { workspaces, users, tasks, sprints, addWorkspace, updateWorkspace, deleteWorkspace } = useTaskContext();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWs, setEditingWs] = useState<Workspace | null>(null);
  
  const [name, setName] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [adGroup, setAdGroup] = useState('');
  const [modules, setModules] = useState<string[]>(['kanban']);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const availableDepartments = useMemo(() => {
    const depts = new Set<string>();
    users.forEach(u => {
      if (u.department && u.department.trim()) depts.add(u.department.trim());
    });
    return Array.from(depts).sort();
  }, [users]);

  const handleOpenAdd = () => {
    setEditingWs(null);
    setName('');
    setOwnerId('');
    setAdGroup('');
    setModules(['kanban']);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (ws: Workspace) => {
    setEditingWs(ws);
    setName(ws.name);
    setOwnerId(ws.ownerId);
    setAdGroup(ws.adGroup || '');
    setModules(ws.enabledModules || ['kanban']);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingWs) {
      updateWorkspace(editingWs.id, { name, ownerId, adGroup, enabledModules: modules });
    } else {
      addWorkspace({ name, ownerId, adGroup, enabledModules: modules });
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (id === 'WS-1') {
      alert('Основное пространство WS-1 удалить нельзя.');
      return;
    }
    if (window.confirm('Вы уверены, что хотите удалить это пространство? Все задачи и спринты из него будут безопасно перенесены в основное пространство WS-1.')) {
      deleteWorkspace(id);
    }
  };

  const handleSyncMembers = async (ws: Workspace) => {
    try {
      const res: any = await apiService.post(`/api/workspaces/${ws.id}/sync-members`, {});
      setSyncMessage(`✅ Пространство «${ws.name}»: синхронизировано по отделам (${res?.syncedCount || 0} новых участников добавлено)`);
      setTimeout(() => setSyncMessage(null), 4500);
    } catch (e: any) {
      alert('Ошибка синхронизации: ' + (e.message || 'Неизвестная ошибка'));
    }
  };

  const toggleModule = (mod: string) => {
    if (modules.includes(mod)) {
      setModules(modules.filter(m => m !== mod));
    } else {
      setModules([...modules, mod]);
    }
  };

  const toggleDeptTag = (dept: string) => {
    const parts = adGroup.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.includes(dept)) {
      setAdGroup(parts.filter(p => p !== dept).join(', '));
    } else {
      setAdGroup([...parts, dept].join(', '));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', color: 'hsl(var(--text-primary))' }}>Управление Пространствами Департаментов (Workspaces)</h2>
          <p style={{ margin: 0, color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>
            Изолированные рабочие области для департаментов и отделов с автоматической привязкой сотрудников из Active Directory
          </p>
        </div>
        <button className="btn-primary" onClick={handleOpenAdd}>+ Создать Workspace</button>
      </div>

      {syncMessage && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#10b981', fontWeight: 600 }}>
          {syncMessage}
        </div>
      )}

      <div className="admin-table-card">
        <div className="table-responsive-wrapper">
          <table className="users-admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Название</th>
                <th>Руководитель (Owner)</th>
                <th>Привязанные Департаменты / Группы AD</th>
                <th>Статистика</th>
                <th>Включенные Модули</th>
                <th style={{ textAlign: 'right' }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {workspaces.map(ws => {
                const owner = users.find(u => u.id === ws.ownerId);
                const wsMembersCount = users.filter(u => (u.workspaceIds || []).includes(ws.id)).length;
                const wsTasksCount = tasks.filter(t => (!t.workspaceId && ws.id === 'WS-1') || t.workspaceId === ws.id).length;
                const wsSprintsCount = sprints.filter(s => (!s.workspaceId && ws.id === 'WS-1') || s.workspaceId === ws.id).length;
                return (
                  <tr key={ws.id}>
                    <td style={{ fontFamily: 'monospace' }}>{ws.id}</td>
                    <td><strong>{ws.name}</strong></td>
                    <td>{owner ? `${owner.name} (${owner.login})` : 'Не назначен'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {ws.adGroup ? ws.adGroup.split(',').map((g, idx) => (
                          <span key={idx} className="badge badge-outline">{g.trim()}</span>
                        )) : <span style={{ color: 'hsl(var(--text-secondary))' }}>—</span>}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'hsl(var(--text-secondary))' }}>
                      👥 {wsMembersCount} чел. • 📋 {wsTasksCount} задач • 🚀 {wsSprintsCount} спр.
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {ws.enabledModules?.includes('kanban') && <span className="badge badge-success">Канбан</span>}
                        {ws.enabledModules?.includes('security_center') && <span className="badge badge-warning">ИБ-Центр</span>}
                        {ws.enabledModules?.includes('integrations') && <span className="badge badge-purple">Интеграции</span>}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="action-buttons-row" style={{ justifyItems: 'end', justifyContent: 'flex-end', gap: '6px' }}>
                        <button
                          className="btn-icon-mini"
                          onClick={() => handleSyncMembers(ws)}
                          title="Синхронизировать сотрудников по привязанным департаментам"
                        >
                          🔄
                        </button>
                        <button className="btn-icon-mini" onClick={() => handleOpenEdit(ws)} title="Редактировать">✏️</button>
                        {ws.id !== 'WS-1' && (
                          <button className="btn-icon-mini text-danger" onClick={() => handleDelete(ws.id)} title="Удалить">🗑️</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {workspaces.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'hsl(var(--text-secondary))' }}>Нет созданных пространств</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h2>{editingWs ? 'Редактировать Workspace' : 'Новое Workspace Департамента'}</h2>
              <button className="close-button" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSave} className="modal-body form-grid">
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Название пространства *</label>
                <input required type="text" className="input-field" value={name} onChange={e => setName(e.target.value)} placeholder="Например: Департамент Кибербезопасности (ДКБ)" />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Руководитель пространства (Project Admin) *</label>
                <select required className="input-field select-field" value={ownerId} onChange={e => setOwnerId(e.target.value)}>
                  <option value="">-- Выберите руководителя --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.login}) — {u.department}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Привязанные Департаменты / Группы AD (через запятую)</label>
                <input type="text" className="input-field" value={adGroup} onChange={e => setAdGroup(e.target.value)} placeholder="Например: Кибербезопасность, Security, Engineering" />
                <span className="help-text">Сотрудники из этих отделов автоматически получат доступ к этому пространству при входе и синхронизации.</span>
                {availableDepartments.length > 0 && (
                  <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {availableDepartments.map(dept => {
                      const isSelected = adGroup.split(',').map(s => s.trim()).includes(dept);
                      return (
                        <button
                          key={dept}
                          type="button"
                          onClick={() => toggleDeptTag(dept)}
                          style={{
                            padding: '4px 10px',
                            fontSize: '0.76rem',
                            borderRadius: '999px',
                            cursor: 'pointer',
                            border: isSelected ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.15)',
                            background: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.04)',
                            color: isSelected ? '#60a5fa' : 'hsl(var(--text-secondary))'
                          }}
                        >
                          {isSelected ? '✓ ' : '+ '}{dept}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              
              <div className="form-group" style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
                <label>Доступные модули для пространства:</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={modules.includes('kanban')} onChange={() => toggleModule('kanban')} />
                    <span><strong>Канбан-доска и Спринты</strong> (Задачи, Бэклог, Архив спринтов, Аналитика)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={modules.includes('security_center')} onChange={() => toggleModule('security_center')} />
                    <span><strong>Центр Безопасности</strong> (DerScanner SAST, Индикаторы FortiGate, Реестр HR JML)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={modules.includes('integrations')} onChange={() => toggleModule('integrations')} />
                    <span><strong>Интеграции</strong> (API-ключи, Webhook SOAR)</span>
                  </label>
                </div>
              </div>

              <div className="modal-actions" style={{ gridColumn: '1 / -1', marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Отмена</button>
                <button type="submit" className="btn-primary save-btn">Сохранить и синхронизировать</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
