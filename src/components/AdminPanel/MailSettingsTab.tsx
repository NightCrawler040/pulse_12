import React, { useState, useEffect } from 'react';
import { Mail, Inbox, BellRing, Check, AlertTriangle, Loader2, Save, Send } from 'lucide-react';
import { apiService } from '../../services/api';

export const MailSettingsTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [mailSettings, setMailSettings] = useState({
    host: '',
    port: 25,
    user: '',
    password: '',
    from: '',
    ssl: false,
    startTls: false
  });

  const [imapSettings, setImapSettings] = useState({
    enabled: false,
    host: '',
    port: 993,
    user: '',
    password: '',
    tls: true
  });

  const [notificationEvents, setNotificationEvents] = useState({
    taskAssigned: true,
    taskStatusChanged: true,
    deadlineWarning: true,
    tokenExpiration: true
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await apiService.get<any>('/api/settings/mail');
      if (data.mailSettings) setMailSettings(prev => ({ ...prev, ...data.mailSettings }));
      if (data.imapSettings) setImapSettings(prev => ({ ...prev, ...data.imapSettings }));
      if (data.notificationEvents) setNotificationEvents(prev => ({ ...prev, ...data.notificationEvents }));
    } catch (err) {
      console.error('Failed to load mail settings', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setMailSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleImapChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setImapSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleEventChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setNotificationEvents(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const data = await apiService.post<any>('/api/settings/mail', { mailSettings, imapSettings, notificationEvents });
      if (data.success) {
        setMessage({ text: 'Настройки почтовых служб (SMTP и IMAP) успешно сохранены!', type: 'success' });
      } else {
        setMessage({ text: data.error || 'Ошибка сохранения', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const data = await apiService.post<any>('/api/settings/mail/test', { mailSettings });
      if (data.success) {
        setMessage({ text: 'Тестовое соединение с SMTP-сервером установлено успешно!', type: 'success' });
      } else {
        setMessage({ text: data.error || 'Ошибка подключения', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: 'hsl(var(--text-secondary))' }}>
        <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto 10px auto' }} />
        <div>Загрузка настроек почтовых протоколов...</div>
      </div>
    );
  }

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
              background: 'rgba(56, 189, 248, 0.14)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8'
            }}
          >
            <Mail size={26} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '1.3rem', color: 'hsl(var(--text-primary))' }}>
                Почтовый шлюз и Парсер бюллетеней (SMTP & IMAP)
              </h2>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '999px',
                  background: imapSettings.enabled ? 'rgba(16, 185, 129, 0.16)' : 'rgba(100, 116, 139, 0.2)',
                  color: imapSettings.enabled ? '#10b981' : 'hsl(var(--text-secondary))',
                  border: `1px solid ${imapSettings.enabled ? 'rgba(16, 185, 129, 0.4)' : 'rgba(100, 116, 139, 0.3)'}`
                }}
              >
                {imapSettings.enabled ? '🟢 IMAP Парсер Активен' : '⚪ IMAP Выключен'}
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.88rem', color: 'hsl(var(--text-secondary))' }}>
              Автоматический приём бюллетеней KZ-CERT (IP, DNS, хэши KATA) и кадровых PDF-приказов HR (JML), а также отправка уведомлений сотрудникам
            </p>
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
          {message.type === 'success' ? <Check size={18} /> : <AlertTriangle size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Split Grid: IMAP & SMTP */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px', alignItems: 'start' }}>
        {/* IMAP Card */}
        <div
          style={{
            background: 'hsl(var(--bg-secondary))',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Inbox size={19} style={{ color: '#38bdf8' }} />
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'hsl(var(--text-primary))' }}>
                Входящая почта (IMAP SOAR & JML Парсер)
              </h3>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.84rem', color: imapSettings.enabled ? '#10b981' : 'hsl(var(--text-secondary))' }}>
              <input
                type="checkbox"
                name="enabled"
                checked={imapSettings.enabled}
                onChange={handleImapChange}
                style={{ width: '18px', height: '18px', accentColor: '#10b981' }}
              />
              <span>Включен</span>
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label>IMAP Сервер (Хост)</label>
              <input
                type="text"
                className="input-field"
                name="host"
                value={imapSettings.host}
                onChange={handleImapChange}
                placeholder="mail.enpf.kz"
              />
            </div>

            <div className="form-group">
              <label>Порт IMAP</label>
              <input
                type="number"
                className="input-field"
                name="port"
                value={imapSettings.port}
                onChange={handleImapChange}
                placeholder="993"
              />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Почтовый ящик (Логин мониторинга)</label>
              <input
                type="email"
                className="input-field"
                name="user"
                value={imapSettings.user}
                onChange={handleImapChange}
                placeholder="pulse@enpf.kz"
              />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Пароль ящика IMAP</label>
              <input
                type="password"
                className="input-field"
                name="password"
                value={imapSettings.password}
                onChange={handleImapChange}
                placeholder="••••••••"
              />
            </div>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 14px',
              background: 'hsl(var(--bg-tertiary))',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '0.88rem',
              color: 'hsl(var(--text-primary))'
            }}
          >
            <input
              type="checkbox"
              name="tls"
              checked={imapSettings.tls}
              onChange={handleImapChange}
              style={{ width: '18px', height: '18px', accentColor: 'hsl(var(--primary))' }}
            />
            <span>Использовать защищенное соединение TLS / SSL (порт 993)</span>
          </label>

          <div style={{ padding: '12px 14px', background: 'rgba(56, 189, 248, 0.08)', borderLeft: '3px solid #38bdf8', borderRadius: '8px', fontSize: '0.82rem', color: 'hsl(var(--text-secondary))', lineHeight: 1.5 }}>
            <strong>Как работает IMAP-парсер:</strong> при пересылке письма на этот ящик система автоматически распознаёт PDF-приказы HR (отправляя их в реестр JML) или извлекает индикаторы компрометации (IP, DNS, хэши KATA), автоматически блокируя IP на FortiGate.
          </div>
        </div>

        {/* SMTP Card */}
        <div
          style={{
            background: 'hsl(var(--bg-secondary))',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
            <Send size={18} style={{ color: 'hsl(var(--primary))' }} />
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'hsl(var(--text-primary))' }}>
              Исходящая почта (SMTP Уведомления)
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label>SMTP Сервер (Хост)</label>
              <input
                type="text"
                className="input-field"
                name="host"
                value={mailSettings.host}
                onChange={handleChange}
                placeholder="mail.enpf.kz"
              />
            </div>

            <div className="form-group">
              <label>Порт SMTP</label>
              <input
                type="number"
                className="input-field"
                name="port"
                value={mailSettings.port}
                onChange={handleChange}
                placeholder="25, 465, 587"
              />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Адрес отправителя (From E-mail)</label>
              <input
                type="email"
                className="input-field"
                name="from"
                value={mailSettings.from}
                onChange={handleChange}
                placeholder="pulse@enpf.kz"
              />
            </div>

            <div className="form-group">
              <label>Логин SMTP (опционально)</label>
              <input
                type="text"
                className="input-field"
                name="user"
                value={mailSettings.user}
                onChange={handleChange}
                placeholder="pulse@enpf.kz"
              />
            </div>

            <div className="form-group">
              <label>Пароль SMTP</label>
              <input
                type="password"
                className="input-field"
                name="password"
                value={mailSettings.password}
                onChange={handleChange}
                placeholder="••••••••"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 12px',
                background: 'hsl(var(--bg-tertiary))',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '0.84rem',
                color: 'hsl(var(--text-primary))'
              }}
            >
              <input
                type="checkbox"
                name="ssl"
                checked={mailSettings.ssl}
                onChange={handleChange}
                style={{ width: '16px', height: '16px', accentColor: 'hsl(var(--primary))' }}
              />
              <span>SSL / TLS (Порт 465)</span>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 12px',
                background: 'hsl(var(--bg-tertiary))',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '0.84rem',
                color: 'hsl(var(--text-primary))'
              }}
            >
              <input
                type="checkbox"
                name="startTls"
                checked={mailSettings.startTls}
                onChange={handleChange}
                style={{ width: '16px', height: '16px', accentColor: 'hsl(var(--primary))' }}
              />
              <span>STARTTLS (Порт 587/25)</span>
            </label>
          </div>
        </div>
      </div>

      {/* Notification Triggers Card */}
      <div
        style={{
          background: 'hsl(var(--bg-secondary))',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '24px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
          <BellRing size={18} style={{ color: 'hsl(var(--primary))' }} />
          <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'hsl(var(--text-primary))' }}>
            Триггеры автоматических почтовых уведомлений
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
          {[
            { name: 'taskAssigned', label: 'При назначении новой задачи сотруднику или группе' },
            { name: 'taskStatusChanged', label: 'При изменении статуса задачи (К выполнению -> Готово)' },
            { name: 'deadlineWarning', label: 'Предупреждения об истечении SLA / дедлайна (за 24ч и 2ч)' },
            { name: 'tokenExpiration', label: 'Оповещения администраторам о критических событиях ИБ' }
          ].map(ev => (
            <label
              key={ev.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                padding: '12px 14px',
                background: 'hsl(var(--bg-tertiary))',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                fontSize: '0.86rem',
                color: 'hsl(var(--text-primary))'
              }}
            >
              <input
                type="checkbox"
                name={ev.name}
                checked={(notificationEvents as any)[ev.name]}
                onChange={handleEventChange}
                style={{ width: '18px', height: '18px', accentColor: 'hsl(var(--primary))' }}
              />
              <span>{ev.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Footer Actions */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn-secondary"
          onClick={handleTest}
          disabled={testing || saving}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {testing ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
          <span>Проверить SMTP соединение</span>
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={handleSave}
          disabled={testing || saving}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          <span>Сохранить настройки почты</span>
        </button>
      </div>
    </div>
  );
};
