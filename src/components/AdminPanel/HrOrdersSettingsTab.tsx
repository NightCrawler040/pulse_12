import React, { useState, useEffect } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';

const HrOrdersSettingsTab: React.FC = () => {
  const { workspaces, groups } = useTaskContext();
  const { currentUser } = useAuth();
  const [workspaceId, setWorkspaceId] = useState<string>('WS-1');
  const [groupId, setGroupId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    // Load existing settings
    fetch('/api/settings/hr', {
      headers: { 'x-auth-user': currentUser?.id || '', Authorization: `Bearer ${localStorage.getItem('korpjira-auth-token')}` }
    })
      .then(r => r.json())
      .then(data => {
        if (data.hrSettings) {
          setWorkspaceId(data.hrSettings.workspaceId || 'WS-1');
          setGroupId(data.hrSettings.groupId || '');
        }
      })
      .catch(console.error);
  }, []);

  const handleSave = async () => {
    setIsLoading(true);
    setSaveStatus(null);
    try {
      const res = await fetch('/api/settings/hr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-user': currentUser?.id || '', Authorization: `Bearer ${localStorage.getItem('korpjira-auth-token')}` },
        body: JSON.stringify({
          hrSettings: { workspaceId, groupId: groupId || null }
        })
      });
      const data = await res.json();
      if (data.success) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus(null), 3000);
      } else {
        setSaveStatus('Ошибка: ' + (data.error || 'Неизвестная ошибка'));
      }
    } catch (e: any) {
      setSaveStatus('Сетевая ошибка: ' + e.message);
    }
    setIsLoading(false);
  };

  const filteredGroups = groups.filter(g => !g.workspaceId || g.workspaceId === workspaceId);

  return (
    <div className="admin-section animate-fade-in">
      <h2>Настройки HR Приказов (JML)</h2>
      <p className="admin-subtitle" style={{ marginBottom: '24px' }}>
        Выберите Workspace и Группу ИБ, в которую будут падать уведомления при парсинге PDF-приказов из почты.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px' }}>
        <div style={{
          background: 'hsl(var(--bg-secondary))',
          border: '1px solid hsl(var(--border-color))',
          borderRadius: '12px',
          padding: '18px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          
          <div className="form-group">
            <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
              Целевой Workspace
            </label>
            <select
              className="admin-input"
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
            >
              {workspaces.map(ws => (
                <option key={ws.id} value={ws.id}>{ws.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
              Целевая Группа (опционально)
            </label>
            <select
              className="admin-input"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
            >
              <option value="">-- Всем в Workspace --</option>
              {filteredGroups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginTop: '6px' }}>
              Если выбрано, push-уведомления и WebSocket броадкасты будут направлены только участникам этой группы.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '8px' }}>
            <button 
              className="btn-primary" 
              onClick={handleSave}
              disabled={isLoading}
            >
              {isLoading ? 'Сохранение...' : 'Сохранить настройки'}
            </button>
            {saveStatus === 'success' && <span style={{ color: '#10b981', fontSize: '0.9rem' }}>✓ Успешно сохранено</span>}
            {saveStatus === 'error' && <span style={{ color: '#ef4444', fontSize: '0.9rem' }}>Ошибка сохранения</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HrOrdersSettingsTab;
