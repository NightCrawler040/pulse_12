import React, { useState } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { Workspace } from '../../types';

export const WorkspacesTab: React.FC = () => {
  const { workspaces, users, addWorkspace, updateWorkspace, deleteWorkspace, groups } = useTaskContext();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWs, setEditingWs] = useState<Workspace | null>(null);
  
  const [name, setName] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [adGroup, setAdGroup] = useState('');
  const [modules, setModules] = useState<string[]>(['kanban']);

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
    setAdGroup(ws.adGroup);
    setModules(ws.enabledModules || []);
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
    if (window.confirm('Вы уверены, что хотите удалить это пространство?')) {
      deleteWorkspace(id);
    }
  };

  const toggleModule = (mod: string) => {
    if (modules.includes(mod)) {
      setModules(modules.filter(m => m !== mod));
    } else {
      setModules([...modules, mod]);
    }
  };

  return (
    <div className="admin-tab-content active">
      <div className="tab-header">
        <div>
          <h2>Управление Пространствами (Workspaces)</h2>
          <p className="tab-description">Изолированные рабочие области для департаментов</p>
        </div>
        <button className="primary-button" onClick={handleOpenAdd}>+ Создать Workspace</button>
      </div>

      <div className="table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Название</th>
              <th>Владелец (Admin)</th>
              <th>Группа AD</th>
              <th>Включенные Модули</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {workspaces.map(ws => {
              const owner = users.find(u => u.id === ws.ownerId);
              return (
                <tr key={ws.id}>
                  <td style={{ fontFamily: 'monospace' }}>{ws.id}</td>
                  <td><strong>{ws.name}</strong></td>
                  <td>{owner ? \`\${owner.name} (\${owner.login})\` : 'Не назначен'}</td>
                  <td><span className="badge badge-outline">{ws.adGroup || '—'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {ws.enabledModules?.includes('kanban') && <span className="badge badge-success">Канбан</span>}
                      {ws.enabledModules?.includes('security_center') && <span className="badge badge-warning">ИБ-Центр</span>}
                      {ws.enabledModules?.includes('integrations') && <span className="badge badge-purple">Интеграции</span>}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="icon-button edit" onClick={() => handleOpenEdit(ws)} title="Редактировать">✏️</button>
                      <button className="icon-button delete" onClick={() => handleDelete(ws.id)} title="Удалить">🗑️</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {workspaces.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>Нет созданных пространств</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>{editingWs ? 'Редактировать Workspace' : 'Новое Workspace'}</h2>
              <button className="close-button" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSave} className="modal-body form-grid">
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Название пространства *</label>
                <input required type="text" className="input-field" value={name} onChange={e => setName(e.target.value)} placeholder="Например: IT Department" />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Владелец (Project Admin) *</label>
                <select required className="input-field select-field" value={ownerId} onChange={e => setOwnerId(e.target.value)}>
                  <option value="">-- Выберите пользователя --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.login}) - {u.department}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Группа AD (для авто-добавления)</label>
                <input type="text" className="input-field" value={adGroup} onChange={e => setAdGroup(e.target.value)} placeholder="Например: IT_Users" />
                <span className="help-text">Если пользователь состоит в этой AD группе, он автоматически попадет в это пространство.</span>
              </div>
              
              <div className="form-group" style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
                <label>Доступные модули для пространства:</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={modules.includes('kanban')} onChange={() => toggleModule('kanban')} />
                    <span><strong>Канбан-доска</strong> (Задачи, спринты)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={modules.includes('security_center')} onChange={() => toggleModule('security_center')} />
                    <span><strong>Security Center</strong> (Анализ уязвимостей, Дерсканер)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={modules.includes('integrations')} onChange={() => toggleModule('integrations')} />
                    <span><strong>Интеграции</strong> (Настройки ключей, FortiGate)</span>
                  </label>
                </div>
              </div>

              <div className="modal-actions" style={{ gridColumn: '1 / -1' }}>
                <button type="button" className="secondary-button" onClick={() => setIsModalOpen(false)}>Отмена</button>
                <button type="submit" className="primary-button">Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
