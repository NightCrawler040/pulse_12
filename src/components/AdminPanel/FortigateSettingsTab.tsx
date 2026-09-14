import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';

export const FortigateSettingsTab: React.FC<{workspaceId?: string; }> = ({workspaceId}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    enabled: false,
    autoBanEnabled: false,
    banUrl: '',
    unbanUrl: '',
    apiToken: '',
    banDurationDays: 90,
    addressGroup: '',
    tempGroups: ['Pulse_Temp_1', 'Pulse_Temp_2', 'Pulse_Temp_3'],
    permGroup: 'Pulse_Perm',
    maxPerGroup: 600,
    groupCapacities: {} as Record<string, number>
  });

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const fetchSettings = async () => {
    try {
      const url = workspaceId ? `/api/fortigate/settings?workspaceId=${workspaceId}` : '/api/fortigate/settings';
      const res: any = await apiService.get(url);
      setSettings(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (workspaceId) fetchSettings();
  }, [workspaceId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res: any = await apiService.post('/api/fortigate/settings', { ...settings, workspaceId });
      if (res.success) {
        setSettings(res.settings);
        setMessage({ text: "Настройки успешно сохранены!", type: 'success' });
      } else {
        setMessage({ text: res.error || "Ошибка сохранения", type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message || "Ошибка", type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setMessage(null);
    try {
      const res: any = await apiService.post('/api/fortigate/test', { workspaceId });
      if (res.success) {
        setMessage({ text: res.message || "Успешное тестовое подключение к FortiGate", type: 'success' });
      } else {
        setMessage({ text: res.error || "Ошибка", type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message || "Ошибка", type: 'error' });
    } finally {
      setIsTesting(false);
    }
  };

  if (loading) return <div>Загрузка...</div>;

  return (
    <div className="admin-tab-content fade-in" style={{ padding: '20px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h2 style={{ marginBottom: '16px' }}>Настройки FortiGate (Авто-блокировка)</h2>
        
        {message && (
          <div style={{ padding: '12px 16px', marginBottom: '20px', borderRadius: '8px', background: message.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: message.type === 'success' ? '#22c55e' : '#ef4444' }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSave} className="admin-form">
          <div className="form-group checkbox-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={settings.enabled}
                onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
              />
              Включить интеграцию с FortiGate
            </label>
            <p className="help-text">Если включено, система сможет отправлять webhook'и в FortiGate для блокировки IP-адресов.</p>
          </div>

          <div className="form-group checkbox-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={settings.autoBanEnabled}
                onChange={(e) => setSettings({ ...settings, autoBanEnabled: e.target.checked })}
                disabled={!settings.enabled}
              />
              Автоматическая блокировка (Auto-Ban)
            </label>
            <p className="help-text">Если включено, найденные вредоносные IP-адреса будут блокироваться автоматически без подтверждения администратором.</p>
          </div>

          <hr style={{ margin: '24px 0', borderColor: 'var(--border-color)', opacity: 0.5 }} />
          <h3 className="admin-card-title">Параметры Webhook API</h3>

          <div className="form-group">
            <label>Webhook URL (Блокировка / Ban)</label>
            <input 
              type="text" 
              value={settings.banUrl}
              onChange={(e) => setSettings({ ...settings, banUrl: e.target.value })}
              placeholder="https://fortigate-ip:443/api/v2/monitor/system/automation-stitch/webhook/ban_ip"
            />
          </div>

          <div className="form-group">
            <label>Webhook URL (Разблокировка / Unban)</label>
            <input 
              type="text" 
              value={settings.unbanUrl}
              onChange={(e) => setSettings({ ...settings, unbanUrl: e.target.value })}
              placeholder="https://fortigate-ip:443/api/v2/monitor/system/automation-stitch/webhook/unban_ip"
            />
          </div>

          <div className="form-group">
            <label>FortiGate API Token</label>
            <input 
              type="password" 
              value={settings.apiToken}
              onChange={(e) => setSettings({ ...settings, apiToken: e.target.value })}
              placeholder={settings.apiToken ? "******** (токен сохранен)" : "Введите токен для Webhook"}
            />
          </div>

          <hr style={{ margin: '24px 0', borderColor: 'var(--border-color)', opacity: 0.5 }} />
          <h3 className="admin-card-title">Балансировщик групп (Allocator)</h3>

          <div className="form-group">
            <label>Группа для бессрочных блокировок (Permanent)</label>
            <input
              type="text"
              value={settings.permGroup || 'Pulse_Perm'}
              onChange={(e) => setSettings({ ...settings, permGroup: e.target.value })}
              placeholder="Например: Pulse_Perm"
            />
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Заполнено: {settings.groupCapacities?.[settings.permGroup || 'Pulse_Perm'] || 0} шт.
            </div>
          </div>
          
          <div className="form-group">
            <label>Группы для временных блокировок (через запятую)</label>
            <input
              type="text"
              value={(settings.tempGroups || []).join(', ')}
              onChange={(e) => setSettings({ ...settings, tempGroups: e.target.value.split(',').map((s: string) => s.trim()).filter((s: string) => s) })}
              placeholder="Pulse_Temp_1, Pulse_Temp_2, Pulse_Temp_3"
            />
            <p className="help-text">Система будет автоматически распределять новые IP по этим группам (по умолчанию до {settings.maxPerGroup} адресов на группу).</p>
            
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(settings.tempGroups || []).map((group: string) => {
                const count = settings.groupCapacities?.[group] || 0;
                const max = settings.maxPerGroup || 600;
                const percent = Math.min(100, Math.round((count / max) * 100));
                let barColor = '#22c55e'; // green
                if (percent > 75) barColor = '#eab308'; // yellow
                if (percent > 95) barColor = '#ef4444'; // red
                
                return (
                  <div key={group}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{group}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{count} / {max} ({percent}%)</span>
                    </div>
                    <div style={{ width: '100%', backgroundColor: 'var(--bg-secondary)', borderRadius: '999px', height: '8px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', backgroundColor: barColor, width: percent + '%', borderRadius: '999px' }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="form-group">
            <label>Срок блокировки по умолчанию (дней)</label>
            <input 
              type="number" 
              value={settings.banDurationDays}
              onChange={(e) => setSettings({ ...settings, banDurationDays: parseInt(e.target.value) || 90 })}
              min="1"
              max="3650"
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Сохранение...' : 'Сохранить настройки'}
            </button>
            <button type="button" className="btn-secondary" onClick={handleTest} disabled={isTesting || !settings.enabled}>
              {isTesting ? 'Проверка...' : 'Тестовый запрос в FortiGate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};