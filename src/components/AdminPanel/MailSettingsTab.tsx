import React, { useState, useEffect } from 'react';
import { Mail, Check, AlertTriangle, Loader2 } from 'lucide-react';

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
      const res = await fetch('/api/settings/mail');
      const data = await res.json();
      if (data.mailSettings) setMailSettings(prev => ({ ...prev, ...data.mailSettings }));
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
      const res = await fetch('/api/settings/mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mailSettings, notificationEvents })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: 'Настройки успешно сохранены', type: 'success' });
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
      const res = await fetch('/api/settings/mail/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mailSettings })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: 'Тестовое соединение успешно!', type: 'success' });
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
    return <div style={{ padding: '40px', textAlign: 'center' }}><Loader2 className="animate-spin" size={32} /></div>;
  }

  return (
    <div className="settings-section animate-fade-in" style={{ maxWidth: '800px' }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
        <Mail size={22} className="text-blue" />
        Настройки E-mail (SMTP)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
        <div className="form-group">
          <label className="form-label">Хост (SMTP сервер)</label>
          <input type="text" className="form-input" name="host" value={mailSettings.host} onChange={handleChange} placeholder="например: smtp.yandex.ru" />
        </div>
        
        <div className="form-group">
          <label className="form-label">Порт</label>
          <input type="number" className="form-input" name="port" value={mailSettings.port} onChange={handleChange} placeholder="25, 465, 587" />
        </div>

        <div className="form-group">
          <label className="form-label">От кого (Sender E-mail)</label>
          <input type="email" className="form-input" name="from" value={mailSettings.from} onChange={handleChange} placeholder="pulse@company.kz" />
        </div>

        <div className="form-group">
          <label className="form-label">Логин (Пользователь)</label>
          <input type="text" className="form-input" name="user" value={mailSettings.user} onChange={handleChange} placeholder="user@company.kz" />
        </div>

        <div className="form-group">
          <label className="form-label">Пароль</label>
          <input type="password" className="form-input" name="password" value={mailSettings.password} onChange={handleChange} placeholder="••••••••" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input type="checkbox" name="ssl" checked={mailSettings.ssl} onChange={handleChange} style={{ width: '18px', height: '18px' }} />
          <span>SSL (Обычно порт 465)</span>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input type="checkbox" name="startTls" checked={mailSettings.startTls} onChange={handleChange} style={{ width: '18px', height: '18px' }} />
          <span>STARTTLS (Обычно порт 587 или 25)</span>
        </label>
      </div>

      <div style={{ padding: '15px', background: 'hsl(var(--bg-secondary))', borderRadius: '8px', marginBottom: '40px', borderLeft: '4px solid #3b82f6' }}>
        <h4 style={{ margin: '0 0 10px 0', color: 'hsl(var(--text-primary))' }}>ℹ️ Подсказка по настройке</h4>
        <p style={{ margin: '0 0 5px 0', fontSize: '0.9rem', color: 'hsl(var(--text-secondary))' }}>
          • <strong>Хост:</strong> Адрес вашего почтового сервера (например, <code>postfix</code>, <code>mail.enpf.kz</code>, <code>smtp.yandex.ru</code>).
        </p>
        <p style={{ margin: '0 0 5px 0', fontSize: '0.9rem', color: 'hsl(var(--text-secondary))' }}>
          • <strong>Логин и Пароль:</strong> Данные аккаунта, от имени которого будут отправляться письма. Если у вас корпоративный сервер (как postfix) без авторизации внутри сети, оставьте их пустыми.
        </p>
        <p style={{ margin: '0 0 5px 0', fontSize: '0.9rem', color: 'hsl(var(--text-secondary))' }}>
          • <strong>От кого:</strong> Почта, которая будет отображаться у получателя (например <code>pulse@enpf.kz</code>).
        </p>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'hsl(var(--text-secondary))' }}>
          • <strong>Получатели:</strong> Система автоматически находит почты всех администраторов в базе для системных писем, и почты исполнителей для уведомлений по задачам. Вручную никого вбивать не нужно!
        </p>
      </div>

      <h3 style={{ borderTop: '1px solid hsl(var(--border-color))', paddingTop: '30px', marginBottom: '20px' }}>
        Оповещения (Triggers)
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '40px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '12px', background: 'hsl(var(--bg-secondary))', borderRadius: '8px' }}>
          <input type="checkbox" name="taskAssigned" checked={notificationEvents.taskAssigned} onChange={handleEventChange} style={{ width: '18px', height: '18px' }} />
          <span>Письмо пользователю при назначении новой задачи</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '12px', background: 'hsl(var(--bg-secondary))', borderRadius: '8px' }}>
          <input type="checkbox" name="taskStatusChanged" checked={notificationEvents.taskStatusChanged} onChange={handleEventChange} style={{ width: '18px', height: '18px' }} />
          <span>Письмо пользователю при изменении статуса его задачи</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '12px', background: 'hsl(var(--bg-secondary))', borderRadius: '8px' }}>
          <input type="checkbox" name="deadlineWarning" checked={notificationEvents.deadlineWarning} onChange={handleEventChange} style={{ width: '18px', height: '18px' }} />
          <span>Предупреждения о горящем дедлайне (за 24ч и за 2ч)</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '12px', background: 'hsl(var(--bg-secondary))', borderRadius: '8px' }}>
          <input type="checkbox" name="tokenExpiration" checked={notificationEvents.tokenExpiration} onChange={handleEventChange} style={{ width: '18px', height: '18px' }} />
          <span>Письмо администраторам о системных ошибках</span>
        </label>
      </div>

      {message && (
        <div style={{ padding: '12px', borderRadius: '8px', marginBottom: '20px', background: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: message.type === 'success' ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {message.type === 'success' ? <Check size={18} /> : <AlertTriangle size={18} />}
          {message.text}
        </div>
      )}

      <div style={{ display: 'flex', gap: '15px' }}>
        <button className="btn-secondary" onClick={handleTest} disabled={testing || saving} style={{ minWidth: '200px' }}>
          {testing ? <Loader2 className="animate-spin" size={18} /> : 'Проверить соединение'}
        </button>
        <button className="btn-primary" onClick={handleSave} disabled={testing || saving} style={{ minWidth: '150px' }}>
          {saving ? <Loader2 className="animate-spin" size={18} /> : 'Сохранить'}
        </button>
      </div>
    </div>
  );
};
