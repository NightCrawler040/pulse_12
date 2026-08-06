import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';

export const FortigateSettingsTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    enabled: false,
    autoBanEnabled: false,
    banUrl: '',
    unbanUrl: '',
    apiToken: '',
    banDurationDays: 90,
    addressGroup: ''
  });

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await apiService.get('/api/fortigate/settings');
      setSettings(data);
    } catch (err) {
      console.error('Ошибка загрузки настроек FortiGate', err);
      setMessage({ text: 'Не удалось загрузить настройки', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await apiService.post('/api/fortigate/settings', settings);
      setSettings(res.settings);
      setMessage({ text: 'Настройки успешно сохранены', type: 'success' });
    } catch (err) {
      console.error('Ошибка сохранения', err);
      setMessage({ text: 'Ошибка при сохранении настроек', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? parseInt(value, 10) : value)
    }));
  };

  if (loading) {
    return <div style={{ padding: '20px' }}>Загрузка настроек...</div>;
  }

  return (
    <div style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{
        background: 'hsl(var(--bg-secondary))',
        padding: '24px',
        borderRadius: '12px',
        border: '1px solid hsl(var(--border-color))'
      }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'hsl(var(--text-primary))', marginBottom: '8px' }}>
          Интеграция с FortiGate (SOAR)
        </h2>
        <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem', marginBottom: '24px', lineHeight: 1.5 }}>
          Настройте связь с межсетевым экраном FortiGate через механизм Automation Stitches (Incoming Webhook). 
          Это позволит системе автоматически или в ручном режиме отправлять команды на блокировку обнаруженных вредоносных IP-адресов.
        </p>

        {message && (
          <div style={{ 
            padding: '12px', 
            borderRadius: '6px', 
            marginBottom: '20px', 
            background: message.type === 'success' ? 'rgba(46, 204, 113, 0.1)' : 'rgba(231, 76, 60, 0.1)',
            color: message.type === 'success' ? '#2ecc71' : '#e74c3c',
            border: `1px solid ${message.type === 'success' ? 'rgba(46, 204, 113, 0.3)' : 'rgba(231, 76, 60, 0.3)'}`
          }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(0,0,0,0.1)', padding: '16px', borderRadius: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                name="enabled" 
                checked={settings.enabled} 
                onChange={handleChange} 
                style={{ width: '18px', height: '18px', accentColor: 'hsl(var(--primary))' }}
              />
              <span style={{ fontWeight: 500 }}>Включить интеграцию с FortiGate</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                name="autoBanEnabled" 
                checked={settings.autoBanEnabled} 
                onChange={handleChange} 
                style={{ width: '18px', height: '18px', accentColor: 'hsl(var(--primary))' }}
                disabled={!settings.enabled}
              />
              <span>
                <span style={{ fontWeight: 500 }}>Автоматическая блокировка (SOAR)</span>
                <br/>
                <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>
                  При обнаружении IP-адреса в письме, система немедленно отправит команду на блокировку.
                </span>
              </span>
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'hsl(var(--text-secondary))' }}>
              URL Вебхука Блокировки (Trigger 1)
            </label>
            <input 
              type="text" 
              name="banUrl" 
              value={settings.banUrl} 
              onChange={handleChange} 
              placeholder="https://172.31.69.30:10443/api/v2/monitor/system/automation-stitch/webhook/Pulse12_API"
              disabled={!settings.enabled}
              style={{
                background: 'hsl(var(--bg-primary))',
                border: '1px solid hsl(var(--border-color))',
                color: 'hsl(var(--text-primary))',
                padding: '10px 12px',
                borderRadius: '6px',
                width: '100%'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'hsl(var(--text-secondary))' }}>
              URL Вебхука Разблокировки (Trigger 2 - Опционально)
            </label>
            <input 
              type="text" 
              name="unbanUrl" 
              value={settings.unbanUrl} 
              onChange={handleChange} 
              placeholder="https://172.31.69.30:10443/api/v2/monitor/system/automation-stitch/webhook/Pulse12_Unban"
              disabled={!settings.enabled}
              style={{
                background: 'hsl(var(--bg-primary))',
                border: '1px solid hsl(var(--border-color))',
                color: 'hsl(var(--text-primary))',
                padding: '10px 12px',
                borderRadius: '6px',
                width: '100%'
              }}
            />
            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))' }}>
              Используется планировщиком (Cron) для автоматического снятия блокировок по истечению таймера.
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'hsl(var(--text-secondary))' }}>
              API Token (Ключ администратора REST API)
            </label>
            <input 
              type="password" 
              name="apiToken" 
              value={settings.apiToken} 
              onChange={handleChange} 
              placeholder="Введите токен"
              disabled={!settings.enabled}
              style={{
                background: 'hsl(var(--bg-primary))',
                border: '1px solid hsl(var(--border-color))',
                color: 'hsl(var(--text-primary))',
                padding: '10px 12px',
                borderRadius: '6px',
                width: '100%'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'hsl(var(--text-secondary))' }}>
              Срок блокировки по умолчанию (дней)
            </label>
            <input 
              type="number" 
              name="banDurationDays" 
              value={settings.banDurationDays} 
              onChange={handleChange} 
              min="1"
              max="3650"
              disabled={!settings.enabled}
              style={{
                background: 'hsl(var(--bg-primary))',
                border: '1px solid hsl(var(--border-color))',
                color: 'hsl(var(--text-primary))',
                padding: '10px 12px',
                borderRadius: '6px',
                width: '150px'
              }}
            />
            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))' }}>
              Через указанное количество дней система попытается отправить запрос на вебхук разблокировки (если он указан).
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'hsl(var(--text-secondary))' }}>
              Целевая группа (Address Group) на FortiGate
            </label>
            <input 
              type="text" 
              name="addressGroup" 
              value={settings.addressGroup || ''} 
              onChange={handleChange} 
              placeholder="Pulse_Banned_IPs"
              disabled={!settings.enabled}
              style={{
                background: 'hsl(var(--bg-primary))',
                border: '1px solid hsl(var(--border-color))',
                color: 'hsl(var(--text-primary))',
                padding: '10px 12px',
                borderRadius: '6px',
                width: '100%'
              }}
            />
            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))' }}>
              Pulse 12 передаст это имя в параметре "address_group". Скрипт (Action) на FortiGate должен использовать эту переменную для добавления IP в нужную папку.
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button 
              type="submit" 
              disabled={saving}
              style={{
                background: 'hsl(var(--primary))',
                color: 'white',
                border: 'none',
                padding: '10px 24px',
                borderRadius: '6px',
                fontWeight: 500,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
                transition: 'opacity 0.2s'
              }}
            >
              {saving ? 'Сохранение...' : 'Сохранить настройки'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
