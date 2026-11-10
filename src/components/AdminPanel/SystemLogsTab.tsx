import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../../services/api';

interface LogEntry {
  id: number;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | string;
  category: string;
  message: string;
}

const CATEGORIES = [
  { id: 'all', label: 'Все модули' },
  { id: 'IMAP', label: '✉️ IMAP Почта' },
  { id: 'FortiGate', label: '🛡️ FortiGate SOAR' },
  { id: 'LDAP', label: '🔐 Active Directory (LDAP)' },
  { id: 'DerScanner/Jira', label: '🐞 DerScanner / Jira' },
  { id: 'SMTP', label: '📤 SMTP Уведомления' },
  { id: 'Security', label: '🚨 Безопасность' },
  { id: 'Backup', label: '💾 Бэкапы' },
  { id: 'HTTP', label: '🌐 HTTP Запросы' },
  { id: 'System', label: '⚙️ Система' }
];

export const SystemLogsTab: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [category, setCategory] = useState<string>('all');
  const [level, setLevel] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.fetchSystemLogs({
        category,
        level,
        search: search.trim() || undefined,
        limit: 300
      });
      if (res && Array.isArray(res.logs)) {
        setLogs(res.logs);
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки логов');
    } finally {
      setLoading(false);
    }
  }, [category, level, search]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      loadLogs();
    }, 4000);
    return () => clearInterval(timer);
  }, [autoRefresh, loadLogs]);

  const handleClear = async () => {
    if (!window.confirm('Очистить журнал системных логов в оперативной памяти?')) return;
    try {
      await apiService.clearSystemLogs();
      setLogs([]);
    } catch (err: any) {
      alert(err.message || 'Не удалось очистить логи');
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'IMAP': return '#38bdf8';
      case 'FortiGate': return '#f59e0b';
      case 'LDAP': return '#a855f7';
      case 'DerScanner/Jira': return '#ec4899';
      case 'Security': return '#ef4444';
      case 'Backup': return '#10b981';
      case 'SMTP': return '#6366f1';
      case 'HTTP': return '#64748b';
      default: return '#94a3b8';
    }
  };

  const getLevelStyle = (lvl: string) => {
    if (lvl === 'error') return { color: '#fca5a5', background: 'rgba(239, 68, 68, 0.14)', borderLeft: '3px solid #ef4444' };
    if (lvl === 'warn') return { color: '#fde68a', background: 'rgba(245, 158, 11, 0.12)', borderLeft: '3px solid #f59e0b' };
    return { color: '#e2e8f0', background: 'rgba(15, 23, 42, 0.6)', borderLeft: '3px solid #334155' };
  };

  return (
    <div className="admin-section animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div>
          <h2 style={{ margin: 0 }}>📜 Журнал системных событий (Live Logs)</h2>
          <p className="admin-subtitle" style={{ marginTop: '4px' }}>
            Мониторинг почтового парсера IMAP, блокировок FortiGate SOAR, синхронизации LDAP и вебхуков в реальном времени
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
            />
            Автообновление (4 сек)
          </label>
          <button className="admin-submit-btn" style={{ padding: '8px 14px' }} onClick={loadLogs} disabled={loading}>
            🔄 Обновить
          </button>
          <button
            className="admin-action-btn delete"
            style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.4)' }}
            onClick={handleClear}
          >
            🗑️ Очистить
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <select
          className="admin-input"
          style={{ maxWidth: '240px' }}
          value={category}
          onChange={e => setCategory(e.target.value)}
        >
          {CATEGORIES.map(c => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>

        <select
          className="admin-input"
          style={{ maxWidth: '180px' }}
          value={level}
          onChange={e => setLevel(e.target.value)}
        >
          <option value="all">Все уровни</option>
          <option value="info">ℹ️ Info</option>
          <option value="warn">⚠️ Warning</option>
          <option value="error">❌ Error</option>
        </select>

        <input
          type="text"
          className="admin-input"
          style={{ flex: 1, minWidth: '220px' }}
          placeholder="🔍 Поиск по IP, тексту ошибки, названию группы или почте..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {error && (
        <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', marginBottom: '12px' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Terminal Output */}
      <div
        style={{
          background: '#0b0f19',
          border: '1px solid #1e293b',
          borderRadius: '10px',
          padding: '12px',
          maxHeight: '560px',
          overflowY: 'auto',
          fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
          fontSize: '0.82rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}
      >
        {logs.length === 0 ? (
          <div style={{ color: '#64748b', textAlign: 'center', padding: '32px' }}>
            Записей по выбранным фильтрам пока нет.
          </div>
        ) : (
          logs.map(entry => {
            const style = getLevelStyle(entry.level);
            const timeStr = new Date(entry.timestamp).toLocaleTimeString('ru-RU', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            });
            return (
              <div
                key={entry.id}
                style={{
                  ...style,
                  padding: '8px 10px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  lineHeight: 1.45
                }}
              >
                <span style={{ color: '#64748b', flexShrink: 0 }}>{timeStr}</span>
                <span
                  style={{
                    color: getCategoryColor(entry.category),
                    fontWeight: 700,
                    minWidth: '110px',
                    flexShrink: 0
                  }}
                >
                  [{entry.category}]
                </span>
                <span style={{ flex: 1 }}>{entry.message}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
