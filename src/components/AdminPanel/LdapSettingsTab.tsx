import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';

interface LdapSettings {
  enabled: boolean;
  connectionName: string;
  serverUrl: string;
  baseDN: string;
  userFilter: string;
  loginAttribute: string;
  objectClassUsers: string;
  ignoreCase: boolean;
  groupBaseDN?: string;
  groupFilter?: string;
  objectClassGroups?: string;
  domainName: string;
  bindDN: string;
  bindPassword?: string;
}

export const LdapSettingsTab: React.FC = () => {
  const [settings, setSettings] = useState<LdapSettings>({
    enabled: true,
    connectionName: 'enpf.kz',
    serverUrl: 'ldap://172.31.0.251',
    baseDN: 'DC=enpf,DC=kz',
    userFilter: '(objectClass=person)',
    loginAttribute: 'userPrincipalName',
    objectClassUsers: 'person',
    ignoreCase: true,
    groupBaseDN: 'DC=enpf,DC=kz',
    groupFilter: '',
    objectClassGroups: 'group',
    domainName: 'enpf.kz',
    bindDN: 'security2@enpf.kz',
    bindPassword: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string; error?: string } | null>(null);
  const [syncReport, setSyncReport] = useState<any | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const data = await apiService.get<any>('/api/ldap/settings');
      if (data) {
        setSettings(prev => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.error('Ошибка загрузки настроек LDAP:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTestResult(null);
    try {
      await apiService.post<any>('/api/ldap/settings', settings);
      setTestResult({ success: true, message: '✅ Настройки Active Directory / LDAP успешно сохранены в системе!' });
    } catch (err: any) {
      setTestResult({ success: false, error: err.message || 'Ошибка сохранения настроек' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const data = await apiService.post<any>('/api/ldap/test', settings);
      if (data && data.success) {
        setTestResult({ success: true, message: data.message || '✅ Соединение с Active Directory установлено успешно!' });
      } else {
        setTestResult({ success: false, error: (data && data.error) || 'Ошибка соединения' });
      }
    } catch (err: any) {
      setTestResult({ success: false, error: err.message || 'Ошибка проверки соединения с AD' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setSyncReport(null);
    setTestResult(null);
    try {
      const data = await apiService.post<any>('/api/ldap/sync', settings);
      if (data && data.success) {
        setSyncReport(data.report);
        setTestResult({
          success: true,
          message: `🎉 Синхронизация завершена! Обработано сотрудников: ${data.report.syncedCount}, перепривязано задач по почте: ${data.report.reconciledTasksCount}`
        });
      } else {
        setTestResult({ success: false, error: (data && data.error) || 'Ошибка синхронизации LDAP' });
      }
    } catch (err: any) {
      setTestResult({ success: false, error: err.message || 'Ошибка синхронизации с AD' });
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'hsl(var(--text-secondary))', fontSize: '1.1rem' }}>
        ⏳ Загрузка параметров Active Directory / LDAP...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>
      {/* Banner / Explanation Header */}
      <div style={{
        background: 'hsl(var(--bg-secondary))',
        border: '1px solid hsl(var(--border-color))',
        borderRadius: '16px',
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '16px'
      }}>
        <div style={{ fontSize: '2.4rem', lineHeight: 1 }}>🏢</div>
        <div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', color: 'hsl(var(--text-primary))' }}>
            Параметры подключения Active Directory (LDAP SSO)
          </h3>
          <p style={{ margin: 0, color: 'hsl(var(--text-secondary))', fontSize: '0.95rem', lineHeight: '1.5' }}>
            Настройка единой точки входа и автоматической синхронизации сотрудников с корпоративным сервером Active Directory.<br />
            <strong>Умная синхронизация задач по почте:</strong> При импорте или обновлении пользователей система автоматически сопоставляет их с существующими задачами по почте (<code>mail</code> / <code>userPrincipalName</code>) и логину без создания дубликатов и потери истории выполнения задач.
          </p>
        </div>
      </div>

      {testResult && (
        <div style={{
          padding: '16px 20px',
          borderRadius: '12px',
          background: testResult.success ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
          border: `1px solid ${testResult.success ? '#22c55e' : '#ef4444'}`,
          color: testResult.success ? '#22c55e' : '#f87171',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontWeight: 600,
          fontSize: '0.98rem'
        }}>
          <span style={{ fontSize: '1.4rem' }}>{testResult.success ? '✅' : '❌'}</span>
          <div>
            <div>{testResult.message || testResult.error}</div>
            {syncReport && (
              <div style={{ marginTop: '8px', fontSize: '0.9rem', color: 'hsl(var(--text-primary))', fontWeight: 500 }}>
                📊 <b>Итоги синхронизации:</b> Обработано: <b>{syncReport.syncedCount}</b> | Новых: <b>{syncReport.newUsersCount}</b> | Обновлено: <b>{syncReport.updatedUsersCount}</b> | Перепривязано задач по почте: <b style={{ color: '#22c55e' }}>{syncReport.reconciledTasksCount}</b> | Обновлено инцидентов: <b>{syncReport.reconciledFindingsCount}</b>
              </div>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{
          background: 'hsl(var(--bg-card))',
          border: '1px solid hsl(var(--border-color))',
          borderRadius: '16px',
          padding: '24px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '16px' }}>
            <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⚙️</span> Основные параметры сервера
            </h4>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, color: settings.enabled ? '#22c55e' : 'hsl(var(--text-secondary))' }}>
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={e => setSettings(p => ({ ...p, enabled: e.target.checked }))}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span>Включить авторизацию и синхронизацию через Active Directory</span>
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                Название подключения
              </label>
              <input
                type="text"
                className="input-field"
                value={settings.connectionName}
                onChange={e => setSettings(p => ({ ...p, connectionName: e.target.value }))}
                placeholder="enpf.kz"
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                Адрес сервера (LDAP URI)
              </label>
              <input
                type="text"
                className="input-field"
                value={settings.serverUrl}
                onChange={e => setSettings(p => ({ ...p, serverUrl: e.target.value }))}
                placeholder="ldap://172.31.0.251 или ldaps://172.31.0.251:636"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                Имя домена
              </label>
              <input
                type="text"
                className="input-field"
                value={settings.domainName}
                onChange={e => setSettings(p => ({ ...p, domainName: e.target.value }))}
                placeholder="enpf.kz"
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                Уникальное имя (DN) для пользователей (Base DN)
              </label>
              <input
                type="text"
                className="input-field"
                value={settings.baseDN}
                onChange={e => setSettings(p => ({ ...p, baseDN: e.target.value }))}
                placeholder="DC=enpf,DC=kz"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                Имя пользователя для подключения (Bind DN / UPN)
              </label>
              <input
                type="text"
                className="input-field"
                value={settings.bindDN}
                onChange={e => setSettings(p => ({ ...p, bindDN: e.target.value }))}
                placeholder="security2@enpf.kz или CN=admin,DC=enpf,DC=kz"
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                Пароль сервисной учетной записи
              </label>
              <input
                type="password"
                className="input-field"
                value={settings.bindPassword || ''}
                onChange={e => setSettings(p => ({ ...p, bindPassword: e.target.value }))}
                placeholder={settings.bindPassword === '********' ? '•••••••• (Пароль сохранен)' : 'Введите пароль для чтения AD...'}
              />
            </div>
          </div>
        </div>

        {/* Атрибуты и фильтры поиска */}
        <div style={{
          background: 'hsl(var(--bg-card))',
          border: '1px solid hsl(var(--border-color))',
          borderRadius: '16px',
          padding: '24px'
        }}>
          <h4 style={{ margin: '0 0 20px 0', fontSize: '1.1rem', color: 'hsl(var(--text-primary))', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '16px' }}>
            🔍 Настройки фильтрации и сопоставления атрибутов (Mapping)
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                Фильтр для пользователей
              </label>
              <input
                type="text"
                className="input-field"
                value={settings.userFilter || ''}
                onChange={e => setSettings(p => ({ ...p, userFilter: e.target.value }))}
                placeholder="(objectClass=person) или (&(objectClass=user)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))"
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                Атрибут логинов пользователей
              </label>
              <input
                type="text"
                className="input-field"
                value={settings.loginAttribute || 'userPrincipalName'}
                onChange={e => setSettings(p => ({ ...p, loginAttribute: e.target.value }))}
                placeholder="userPrincipalName или sAMAccountName"
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                objectClass пользователей
              </label>
              <input
                type="text"
                className="input-field"
                value={settings.objectClassUsers || 'person'}
                onChange={e => setSettings(p => ({ ...p, objectClassUsers: e.target.value }))}
                placeholder="person"
              />
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', paddingTop: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 600, color: 'hsl(var(--text-primary))' }}>
                <input
                  type="checkbox"
                  checked={settings.ignoreCase ?? true}
                  onChange={e => setSettings(p => ({ ...p, ignoreCase: e.target.checked }))}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span>Игнорировать регистр логинов и почт (Рекомендуется)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Action Buttons Panel */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          background: 'hsl(var(--bg-card))',
          border: '1px solid hsl(var(--border-color))',
          padding: '20px 24px',
          borderRadius: '16px'
        }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-secondary"
              style={{
                background: 'rgba(59, 130, 246, 0.12)',
                color: '#3b82f6',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                padding: '12px 20px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onClick={handleTestConnection}
              disabled={isTesting || isSyncing}
            >
              {isTesting ? '⏳ Проверка соединения...' : '🔌 Проверить соединение с AD'}
            </button>

            <button
              type="button"
              className="btn-secondary"
              style={{
                background: 'rgba(34, 197, 94, 0.15)',
                color: '#22c55e',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                padding: '12px 20px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onClick={handleSyncNow}
              disabled={isTesting || isSyncing}
            >
              {isSyncing ? '🔄 Синхронизация данных...' : '🔄 Синхронизировать пользователей и задачи сейчас'}
            </button>
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ padding: '12px 28px', fontSize: '1rem', fontWeight: 'bold' }}
            disabled={isSaving || isSyncing}
          >
            {isSaving ? '💾 Сохранение...' : '💾 Сохранить параметры AD'}
          </button>
        </div>
      </form>
    </div>
  );
};
