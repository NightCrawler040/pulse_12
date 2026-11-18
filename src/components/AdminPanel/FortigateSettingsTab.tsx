import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import { Flame, Key, Layers, Clock, CheckCircle2, AlertTriangle, RefreshCw, Save } from 'lucide-react';

const DEFAULT_TEMP_GROUPS = [
  'Malicious IP.s KZ-CERT Pulse_1',
  'Malicious IP.s KZ-CERT Pulse_2',
  'Malicious IP.s KZ-CERT Pulse_3'
];

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
    addressGroup: DEFAULT_TEMP_GROUPS[0],
    tempGroups: DEFAULT_TEMP_GROUPS,
    permGroup: 'Pulse_Perm',
    maxPerGroup: 600,
    groupCapacities: {} as Record<string, number>
  });

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const url = workspaceId ? `/api/fortigate/settings?workspaceId=${workspaceId}` : '/api/fortigate/settings';
      const res: any = await apiService.get(url);
      setSettings(prev => ({
        ...prev,
        ...res,
        tempGroups: (Array.isArray(res?.tempGroups) && res.tempGroups.length > 0) ? res.tempGroups : DEFAULT_TEMP_GROUPS
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [workspaceId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res: any = await apiService.post('/api/fortigate/settings', { ...settings, workspaceId });
      if (res.success) {
        setSettings(res.settings);
        setMessage({ text: "Настройки FortiGate SOAR успешно сохранены!", type: 'success' });
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

  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: 'hsl(var(--text-secondary))' }}>
        Загрузка параметров FortiGate SOAR...
      </div>
    );
  }

  const totalBannedCount = Object.values(settings.groupCapacities || {}).reduce((sum, val) => sum + (Number(val) || 0), 0);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Banner */}
      <div
        style={{
          background: 'hsl(var(--bg-secondary))',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '22px 26px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(239, 68, 68, 0.14)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444'
            }}
          >
            <Flame size={26} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '1.3rem', color: 'hsl(var(--text-primary))' }}>
                Интеграция с FortiGate NGFW (SOAR Auto-Ban)
              </h2>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '999px',
                  background: settings.enabled ? 'rgba(16, 185, 129, 0.16)' : 'rgba(100, 116, 139, 0.2)',
                  color: settings.enabled ? '#10b981' : 'hsl(var(--text-secondary))',
                  border: `1px solid ${settings.enabled ? 'rgba(16, 185, 129, 0.4)' : 'rgba(100, 116, 139, 0.3)'}`
                }}
              >
                {settings.enabled ? '🟢 Активно' : '⚪ Выключено'}
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.88rem', color: 'hsl(var(--text-secondary))' }}>
              Автоматическая блокировка вредоносных IP из бюллетеней KZ-CERT через Automation Stitch Webhook и балансировка по адресным группам FortiOS
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          <div style={{ textAlign: 'right', padding: '8px 14px', borderRadius: '10px', background: 'hsl(var(--bg-tertiary))', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.72rem', color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', fontWeight: 700 }}>Всего в бане</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'hsl(var(--primary))' }}>{totalBannedCount} IP</div>
          </div>
        </div>
      </div>

      {message && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '12px',
            background: message.type === 'success' ? 'rgba(16, 185, 129, 0.14)' : 'rgba(239, 68, 68, 0.14)',
            border: `1px solid ${message.type === 'success' ? '#10b981' : '#ef4444'}`,
            color: message.type === 'success' ? '#10b981' : '#f87171',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontWeight: 600
          }}
        >
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Toggles Card */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '16px'
          }}
        >
          <label
            style={{
              background: 'hsl(var(--bg-secondary))',
              border: `1px solid ${settings.enabled ? 'hsl(var(--primary) / 0.5)' : 'var(--border-color)'}`,
              borderRadius: '14px',
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '14px',
              cursor: 'pointer'
            }}
          >
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
              style={{ width: '20px', height: '20px', marginTop: '2px', accentColor: 'hsl(var(--primary))' }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.96rem', color: 'hsl(var(--text-primary))' }}>
                Включить интеграцию с FortiGate
              </div>
              <div style={{ fontSize: '0.82rem', color: 'hsl(var(--text-secondary))', marginTop: '4px', lineHeight: 1.45 }}>
                Разрешает отправку HTTPS-запросов на Automation Stitch Webhook межсетевого экрана для добавления и удаления IP.
              </div>
            </div>
          </label>

          <label
            style={{
              background: 'hsl(var(--bg-secondary))',
              border: `1px solid ${settings.autoBanEnabled && settings.enabled ? 'rgba(16, 185, 129, 0.5)' : 'var(--border-color)'}`,
              borderRadius: '14px',
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '14px',
              cursor: settings.enabled ? 'pointer' : 'not-allowed',
              opacity: settings.enabled ? 1 : 0.6
            }}
          >
            <input
              type="checkbox"
              checked={settings.autoBanEnabled}
              onChange={(e) => setSettings({ ...settings, autoBanEnabled: e.target.checked })}
              disabled={!settings.enabled}
              style={{ width: '20px', height: '20px', marginTop: '2px', accentColor: '#10b981' }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.96rem', color: 'hsl(var(--text-primary))' }}>
                Автоматическая блокировка из писем (SOAR Auto-Ban)
              </div>
              <div style={{ fontSize: '0.82rem', color: 'hsl(var(--text-secondary))', marginTop: '4px', lineHeight: 1.45 }}>
                Найденные в письмах KZ-CERT вредоносные IP-адреса блокируются мгновенно в фоновом режиме без ручного подтверждения.
              </div>
            </div>
          </label>
        </div>

        {/* Webhook Endpoints Card */}
        <div
          style={{
            background: 'hsl(var(--bg-secondary))',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '24px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
            <Key size={18} style={{ color: 'hsl(var(--primary))' }} />
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'hsl(var(--text-primary))' }}>
              Параметры подключения Webhook API (FortiOS Automation Stitch)
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '18px' }}>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>🔒 Webhook URL (Блокировка / Ban IP)</label>
              <input
                type="text"
                className="input-field"
                value={settings.banUrl}
                onChange={(e) => setSettings({ ...settings, banUrl: e.target.value })}
                placeholder="https://172.31.69.30:10443/api/v2/monitor/system/automation-stitch/webhook/Pulse12%20API%20Ban%20IP"
                style={{ fontFamily: 'monospace', fontSize: '0.86rem' }}
              />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>🔓 Webhook URL (Разблокировка / Unban IP)</label>
              <input
                type="text"
                className="input-field"
                value={settings.unbanUrl}
                onChange={(e) => setSettings({ ...settings, unbanUrl: e.target.value })}
                placeholder="https://172.31.69.30:10443/api/v2/monitor/system/automation-stitch/webhook/Pulse12%20API%20Unban%20IP"
                style={{ fontFamily: 'monospace', fontSize: '0.86rem' }}
              />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>🔑 FortiGate REST API Token (Bearer)</label>
              <input
                type="password"
                className="input-field"
                value={settings.apiToken}
                onChange={(e) => setSettings({ ...settings, apiToken: e.target.value })}
                placeholder={settings.apiToken ? "******** (токен сохранен в зашифрованном хранилище)" : "Введите API-токен администратора REST API FortiGate"}
              />
            </div>
          </div>
        </div>

        {/* Group Allocator & Capacities Card */}
        <div
          style={{
            background: 'hsl(var(--bg-secondary))',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '24px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
            <Layers size={18} style={{ color: 'hsl(var(--primary))' }} />
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'hsl(var(--text-primary))' }}>
              Балансировщик адресных групп FortiGate (Allocator)
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px', marginBottom: '20px' }}>
            <div className="form-group">
              <label>Группа для бессрочных блокировок (Permanent)</label>
              <input
                type="text"
                className="input-field"
                value={settings.permGroup || 'Pulse_Perm'}
                onChange={(e) => setSettings({ ...settings, permGroup: e.target.value })}
                placeholder="Например: Pulse_Perm"
              />
              <span className="help-text">
                Сейчас в постоянной группе: <strong>{settings.groupCapacities?.[settings.permGroup || 'Pulse_Perm'] || 0} шт.</strong>
              </span>
            </div>

            <div className="form-group">
              <label>Лимит адресов на одну группу (Max Per Group)</label>
              <input
                type="number"
                className="input-field"
                value={settings.maxPerGroup || 600}
                onChange={(e) => setSettings({ ...settings, maxPerGroup: parseInt(e.target.value) || 600 })}
                min="50"
                max="5000"
              />
              <span className="help-text">При достижении лимита балансировщик автоматически переключается на следующую группу.</span>
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={14} /> Срок временной блокировки (дней)
              </label>
              <input
                type="number"
                className="input-field"
                value={settings.banDurationDays}
                onChange={(e) => setSettings({ ...settings, banDurationDays: parseInt(e.target.value) || 90 })}
                min="1"
                max="3650"
              />
              <span className="help-text">По истечении срока Cron-служба автоматически отправляет запрос на разбан IP.</span>
            </div>
          </div>

          <div className="form-group">
            <label>Пул групп для временных блокировок (через запятую)</label>
            <input
              type="text"
              className="input-field"
              value={(settings.tempGroups || []).join(', ')}
              onChange={(e) => setSettings({ ...settings, tempGroups: e.target.value.split(',').map((s: string) => s.trim()).filter((s: string) => s) })}
              placeholder="Malicious IP.s KZ-CERT Pulse_1, Malicious IP.s KZ-CERT Pulse_2, Malicious IP.s KZ-CERT Pulse_3"
            />
          </div>

          {/* Visual Capacity Bars */}
          <div style={{ marginTop: '18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
            {(settings.tempGroups || []).map((group: string, idx: number) => {
              const count = settings.groupCapacities?.[group] || 0;
              const max = settings.maxPerGroup || 600;
              const percent = Math.min(100, Math.round((count / max) * 100));
              let barColor = '#10b981';
              if (percent > 75) barColor = '#f59e0b';
              if (percent > 95) barColor = '#ef4444';

              return (
                <div
                  key={group}
                  style={{
                    background: 'hsl(var(--bg-tertiary))',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    padding: '12px 14px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
                      #{idx + 1} {group}
                    </span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: barColor }}>
                      {count} / {max} ({percent}%)
                    </span>
                  </div>
                  <div style={{ width: '100%', backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: '999px', height: '8px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', backgroundColor: barColor, width: `${Math.max(percent, count > 0 ? 3 : 0)}%`, borderRadius: '999px', transition: 'width 0.3s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleTest}
            disabled={isTesting || !settings.enabled}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw size={16} className={isTesting ? 'animate-spin' : ''} />
            <span>{isTesting ? 'Проверка связи с FortiGate...' : 'Проверить соединение (Тест 1.1.1.1)'}</span>
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Save size={16} />
            <span>{saving ? 'Сохранение...' : 'Сохранить настройки FortiGate'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
