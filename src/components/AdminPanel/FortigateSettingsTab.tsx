import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import { Plus, Trash2 } from 'lucide-react';

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
  const [isTesting, setIsTesting] = useState(false);
  const [bannedIps, setBannedIps] = useState<any[]>([]);

  // Add Indicator Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [newIndicatorIp, setNewIndicatorIp] = useState('');
  const [newIndicatorGroup] = useState('Узел ботнет');
  const [newIndicatorTrust] = useState('Высокая');
  const [newIndicatorStatus] = useState('Опубликован');
  const [newIndicatorValidFrom, setNewIndicatorValidFrom] = useState(() => new Date().toISOString().split('T')[0]);
  const [newIndicatorValidTo, setNewIndicatorValidTo] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 90); // default 90 days
    return date.toISOString().split('T')[0];
  });
  const [isAdding, setIsAdding] = useState(false);

  const fetchSettings = async () => {
    try {
      const res: any = await apiService.get('/api/fortigate/settings');
      setSettings(res);
      const bannedRes: any = await apiService.get('/api/fortigate/banned-ips');
      if (bannedRes.success) {
        setBannedIps(bannedRes.bannedIps);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const payload = { ...settings };
      if (payload.apiToken === '********' || !payload.apiToken) {
        delete (payload as any).apiToken;
      }
      const res: any = await apiService.post('/api/fortigate/settings', payload);
      setSettings(res.settings);
      setMessage({ text: 'Настройки успешно сохранены', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message || 'Ошибка при сохранении', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setMessage(null);
    try {
      const res: any = await apiService.post('/api/fortigate/test', {});
      if (res.success) {
        setMessage({ text: res.message || 'Тест успешен! (Ban + Unban сработали)', type: 'success' });
      } else {
        setMessage({ text: res.error || 'Ошибка теста', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Ошибка соединения', type: 'error' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleUnban = async (ip: string) => {
    if (!window.confirm(`Вы уверены, что хотите разблокировать IP ${ip}? Это отправит webhook в FortiGate.`)) return;
    try {
      const res: any = await apiService.post('/api/fortigate/unban', { ip });
      if (res.success) {
        setBannedIps(prev => prev.filter(b => b.ip !== ip));
        setMessage({ text: `IP ${ip} успешно разблокирован`, type: 'success' });
      } else {
        setMessage({ text: res.error || 'Ошибка разблокировки', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Сетевая ошибка', type: 'error' });
    }
  };

  const handleAddIndicator = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdding(true);
    setMessage(null);
    try {
      const validFromTime = new Date(newIndicatorValidFrom).getTime();
      const validToTime = new Date(newIndicatorValidTo).getTime();
      
      const payload = {
        ip: newIndicatorIp,
        isPermanent: false,
        expiresAt: validToTime,
        validFrom: validFromTime,
        group: newIndicatorGroup,
        trustLevel: newIndicatorTrust,
        indicatorStatus: newIndicatorStatus,
      };

      const res: any = await apiService.post('/api/fortigate/ban', payload);
      if (res.success) {
        setBannedIps(prev => {
          const filtered = prev.filter(b => b.ip !== res.banRecord.ip);
          return [res.banRecord, ...filtered];
        });
        setIsAddModalOpen(false);
        setNewIndicatorIp('');
        setMessage({ text: `Индикатор ${newIndicatorIp} добавлен и заблокирован`, type: 'success' });
      } else {
        setMessage({ text: res.error || 'Ошибка при добавлении индикатора', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Сетевая ошибка', type: 'error' });
    } finally {
      setIsAdding(false);
    }
  };

  if (loading) return <div>Загрузка настроек...</div>;

  return (
    <div className="admin-tab-content fade-in">
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h2 style={{ marginBottom: '16px', color: 'hsl(var(--text-primary))' }}>Интеграция FortiGate (SOAR)</h2>
        
        {message && (
          <div style={{ 
            padding: '12px 16px', 
            marginBottom: '20px', 
            borderRadius: '6px',
            background: message.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            color: message.type === 'success' ? '#22c55e' : '#ef4444',
            border: `1px solid ${message.type === 'success' ? '#22c55e' : '#ef4444'}`
          }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="admin-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input 
              type="checkbox" 
              name="enabled" 
              id="fortigate_enabled"
              checked={settings.enabled} 
              onChange={handleChange}
              style={{ width: '18px', height: '18px', accentColor: 'hsl(var(--primary))' }}
            />
            <label htmlFor="fortigate_enabled" style={{ fontSize: '1rem', fontWeight: 600, color: 'hsl(var(--text-primary))', cursor: 'pointer' }}>
              Включить интеграцию SOAR FortiGate
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '28px', marginTop: '-8px', marginBottom: '8px' }}>
            <input 
              type="checkbox" 
              name="autoBanEnabled" 
              id="fortigate_autoban"
              checked={settings.autoBanEnabled} 
              onChange={handleChange}
              disabled={!settings.enabled}
              style={{ width: '16px', height: '16px', accentColor: 'hsl(var(--primary))' }}
            />
            <label htmlFor="fortigate_autoban" style={{ fontSize: '0.9rem', color: settings.enabled ? 'hsl(var(--text-primary))' : 'hsl(var(--text-secondary))', cursor: settings.enabled ? 'pointer' : 'default' }}>
              Автоматически блокировать IP (Auto-Ban) при получении отчетов KATA/KZ-CERT
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'hsl(var(--text-secondary))' }}>
              URL Вебхука Блокировки (Trigger 1 - Добавление IP)
            </label>
            <input 
              type="text" 
              name="banUrl" 
              value={settings.banUrl} 
              onChange={handleChange} 
              placeholder="https://172.31.69.30:10443/api/v2/monitor/system/automation-stitch/webhook/Pulse12_Ban"
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
              Pulse 12 вызовет этот URL при парсинге фишинга или при нажатии кнопки "Заблокировать" в инциденте.
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'hsl(var(--text-secondary))' }}>
              URL Вебхука Разблокировки (Trigger 2 - Исключение IP)
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
              Используется Cron-сервисом для автоматического разбана по истечении срока действия индикатора.
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'hsl(var(--text-secondary))' }}>
              API Token (Для авторизации REST API)
            </label>
            <input 
              type="password" 
              name="apiToken" 
              value={settings.apiToken} 
              onChange={handleChange} 
              placeholder="Скрытый токен"
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
              Срок действия по умолчанию (дней)
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
              Если в источнике не указана явная дата "Действительно до", срок вычисляется по этому значению.
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'hsl(var(--text-secondary))' }}>
              Имя группы (Address Group) в FortiGate
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
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px', gap: '10px' }}>
            <button 
              type="button" 
              onClick={handleTestConnection}
              disabled={isTesting || !settings.enabled}
              style={{
                background: 'hsl(var(--bg-secondary))',
                color: 'hsl(var(--text-primary))',
                border: '1px solid hsl(var(--border-color))',
                padding: '10px 24px',
                borderRadius: '6px',
                fontWeight: 500,
                cursor: (isTesting || !settings.enabled) ? 'not-allowed' : 'pointer',
                opacity: (isTesting || !settings.enabled) ? 0.7 : 1,
                transition: 'opacity 0.2s'
              }}
            >
              {isTesting ? 'Проверка...' : 'Тест Webhook (1.1.1.1)'}
            </button>
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

      {/* Banned IPs / IoC Section */}
      <div className="admin-card" style={{ marginTop: '24px', maxWidth: '100%', overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="admin-card-title" style={{ margin: 0 }}>Таблица индикаторов компрометации (Заблокированные IP)</h3>
          <button 
            className="btn-primary" 
            style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus size={16} /> Добавить индикатор
          </button>
        </div>

        {bannedIps.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>Нет активных индикаторов.</p>
        ) : (
          <div className="table-responsive">
            <table className="admin-table" style={{ minWidth: '900px', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'hsl(var(--bg-secondary))' }}>
                  <th>#</th>
                  <th>Тип индикатора</th>
                  <th>Индикатор компрометации</th>
                  <th>Группа</th>
                  <th>Уровень доверия</th>
                  <th>Статус</th>
                  <th>Действительно с</th>
                  <th>Действительно до</th>
                  <th style={{ textAlign: 'right' }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {paginatedIps.map((b, i) => (
                  <tr key={b.ip}>
                    <td style={{ color: 'var(--text-secondary)' }}>{(currentPage - 1) * itemsPerPage + i + 1}</td>
                    <td>IP адрес</td>
                    <td><span className="badge badge-error">{b.ip}</span></td>
                    <td>{b.group || 'Узел ботнет'}</td>
                    <td>{b.trustLevel || 'Высокая'}</td>
                    <td>{b.indicatorStatus || 'Опубликован'}</td>
                    <td>{new Date(b.validFrom || b.bannedAt).toLocaleString('ru-RU')}</td>
                    <td>{b.expiresAt ? new Date(b.expiresAt).toLocaleString('ru-RU') : 'Навсегда'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        type="button"
                        title="Удалить индикатор (Разбанить)"
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                        onClick={() => handleUnban(b.ip)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Indicator Modal */}
      {isAddModalOpen && (
        <div className="admin-modal-overlay" onClick={() => !isAdding && setIsAddModalOpen(false)}>
          <div className="admin-modal-content" onClick={e => e.stopPropagation()} style={{ width: '500px', padding: '24px' }}>
            <h3 style={{ marginBottom: '20px', color: 'hsl(var(--text-primary))' }}>Добавить индикатор компрометации</h3>
            <form onSubmit={handleAddIndicator} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>IP адрес (Индикатор)</label>
                <input 
                  type="text" 
                  value={newIndicatorIp} 
                  onChange={e => setNewIndicatorIp(e.target.value)}
                  placeholder="Например: 192.168.1.100"
                  required
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid hsl(var(--border-color))', background: 'hsl(var(--bg-primary))', color: 'hsl(var(--text-primary))' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>Действительно с</label>
                  <input 
                    type="date" 
                    value={newIndicatorValidFrom} 
                    onChange={e => setNewIndicatorValidFrom(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid hsl(var(--border-color))', background: 'hsl(var(--bg-primary))', color: 'hsl(var(--text-primary))' }}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>Действительно до</label>
                  <input 
                    type="date" 
                    value={newIndicatorValidTo} 
                    onChange={e => setNewIndicatorValidTo(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid hsl(var(--border-color))', background: 'hsl(var(--bg-primary))', color: 'hsl(var(--text-primary))' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isAdding}
                >
                  Отмена
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={isAdding || !newIndicatorIp}
                >
                  {isAdding ? 'Добавление...' : 'Добавить и Заблокировать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      </div>
    </div>
  );
};
