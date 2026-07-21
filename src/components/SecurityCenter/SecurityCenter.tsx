import React, { useState } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import type { ExternalFinding } from '../../types';
import { 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  ArrowRightCircle, 
  Eye, 
  XCircle, 
  RotateCcw,
  ExternalLink,
  Code2,
  FolderTree,
  Bug,
  Sparkles
} from 'lucide-react';
import './SecurityCenter.css';

export const SecurityCenter: React.FC = () => {
  const { 
    findings, 
    addFinding, 
    updateFindingStatus, 
    deleteFinding, 
    promoteFindingToTask, 
    users, 
    sprints, 
    setActiveTaskModalId, 
    setViewMode 
  } = useTaskContext();
  const { isAdmin, currentUser } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [systemTab, setSystemTab] = useState<'all' | 'derscanner' | 'siem' | 'waf'>('all');

  const canAccessSystem = (source: string) => {
    if (isAdmin || !currentUser) return true;
    const userDept = currentUser.department || '';
    if (source === 'derscanner') {
      return ['Engineering', 'Security', 'QA Engineering', 'Product & Agile', 'Инженерный', 'Разработка', 'Кибербезопасность'].some(d => userDept.includes(d) || d.includes(userDept));
    }
    if (source === 'siem') {
      return ['Security', 'DevOps', 'Engineering', 'Кибербезопасность', 'Инженерный'].some(d => userDept.includes(d) || d.includes(userDept));
    }
    if (source === 'waf') {
      return ['Security', 'DevOps', 'Infrastructure', 'Кибербезопасность'].some(d => userDept.includes(d) || d.includes(userDept));
    }
    return true;
  };

  // Modal states for promoting to task
  const [promotingFinding, setPromotingFinding] = useState<ExternalFinding | null>(null);
  const [selectedAssignee, setSelectedAssignee] = useState<string>('usr-1');
  const [selectedSprint, setSelectedSprint] = useState<string>('unassigned');
  const [selectedPriority, setSelectedPriority] = useState<string>('high');
  const [isPromoting, setIsPromoting] = useState<boolean>(false);

  const activeFindings = findings.filter(f => f.status === 'new' || f.status === 'analyzing');
  const criticalCount = findings.filter(f => (f.severity === 'Critical' || f.severity === 'High') && (f.status === 'new' || f.status === 'analyzing')).length;
  const promotedCount = findings.filter(f => f.status === 'promoted').length;

  const accessibleFindings = findings.filter(f => {
    if (isAdmin || !currentUser) return true;
    const userDept = currentUser.department || '';
    if (f && (f as any).allowedDepartments && Array.isArray((f as any).allowedDepartments) && !(f as any).allowedDepartments.includes('all')) {
      return (f as any).allowedDepartments.some((d: string) => userDept.includes(d) || d.includes(userDept));
    }
    return canAccessSystem(f.source);
  });

  const filteredFindings = accessibleFindings.filter(f => {
    if (systemTab !== 'all' && f.source !== systemTab) return false;
    if (statusFilter === 'active' && f.status !== 'new' && f.status !== 'analyzing') return false;
    if (statusFilter === 'new' && f.status !== 'new') return false;
    if (statusFilter === 'analyzing' && f.status !== 'analyzing') return false;
    if (statusFilter === 'promoted' && f.status !== 'promoted') return false;
    if (statusFilter === 'false_positive' && f.status !== 'false_positive') return false;

    if (severityFilter !== 'all' && f.severity !== severityFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = f.title?.toLowerCase().includes(q);
      const matchDesc = f.description?.toLowerCase().includes(q);
      const matchFile = f.fileLocation?.toLowerCase().includes(q);
      const matchCwe = f.cwe?.toLowerCase().includes(q);
      const matchProj = f.project?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchFile && !matchCwe && !matchProj) return false;
    }

    return true;
  });

  const handlePromoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promotingFinding) return;
    setIsPromoting(true);
    try {
      const res = await promoteFindingToTask(
        promotingFinding.id, 
        selectedAssignee, 
        selectedSprint === 'unassigned' ? undefined : selectedSprint, 
        selectedPriority
      );
      setPromotingFinding(null);
      if (res && res.task) {
        alert(`✅ Уязвимость успешно преобразована в задачу JIRA: ${res.task.id}!`);
      }
    } catch (err) {
      alert('Ошибка при создании задачи из инцидента');
    } finally {
      setIsPromoting(false);
    }
  };

  const handleSimulateAlert = () => {
    const samples = [
      {
        source: 'derscanner' as const,
        title: 'SQL Injection in AuthRepository.java',
        description: 'Обнаружено неэкранированное построение SQL-запроса через конкатенацию строк в методе findUserByEmail(). Возможен несанкционированный доступ к БД.',
        severity: 'Critical' as const,
        project: 'Pulse12 Core Engine',
        fileLocation: 'src/main/java/kz/pulse/AuthRepository.java:184',
        cwe: 'CWE-89',
        status: 'new' as const
      },
      {
        source: 'derscanner' as const,
        title: 'Cross-Site Scripting (Reflected XSS) in SearchBar',
        description: 'Параметр q из GET-запроса выводится в DOM без предварительной санитизации HTML. Возможна инъекция вредоносного JS-скрипта.',
        severity: 'High' as const,
        project: 'Pulse12 Web Portal',
        fileLocation: 'src/components/Search/SearchBar.tsx:42',
        cwe: 'CWE-79',
        status: 'new' as const
      },
      {
        source: 'derscanner' as const,
        title: 'Hardcoded API Secret Key in Config file',
        description: 'В исходном коде обнаружен зашитый секретный ключ AWS S3. Требуется немедленно вынести секрет в переменные окружения.',
        severity: 'Critical' as const,
        project: 'Pulse12 Storage Service',
        fileLocation: 'config/aws_s3.json:12',
        cwe: 'CWE-798',
        status: 'new' as const
      }
    ];
    const randomSample = samples[Math.floor(Math.random() * samples.length)];
    addFinding(randomSample);
  };

  return (
    <div className="security-center-container">
      {/* Header Banner */}
      <div className="security-header-banner">
        <div className="security-header-info">
          <div className="security-header-icon">
            <ShieldAlert size={36} />
          </div>
          <div className="security-header-title">
            <h1>
              <span>🛡️ Центр Инцидентов и Сканеров ИБ</span>
              {criticalCount > 0 && (
                <span style={{ fontSize: '0.8rem', background: '#ef4444', color: 'white', padding: '4px 10px', borderRadius: '12px', fontWeight: 800 }}>
                  {criticalCount} CRITICAL/HIGH
                </span>
              )}
            </h1>
            <p>
              Единый дашборд для приема и триажа алертов от статических (SAST/DAST) анализаторов кода (DerScanner) и систем мониторинга. Анализируйте уязвимости и в один клик отправляйте их разработчикам.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button 
            className="btn-secondary" 
            style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.4)', color: 'hsl(var(--primary))', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={handleSimulateAlert}
            title="Смоделировать поступление алертов от DerScanner для проверки интерфейса"
          >
            <Sparkles size={16} />
            🧪 Тестовый алерт DerScanner
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="security-stats-grid">
        <div className="security-stat-card">
          <div className="stat-content">
            <div className="stat-label">Активные уязвимости</div>
            <div className="stat-value" style={{ color: activeFindings.length > 0 ? '#ef4444' : 'inherit' }}>
              {activeFindings.length}
            </div>
          </div>
          <AlertTriangle size={32} style={{ color: activeFindings.length > 0 ? '#ef4444' : 'hsl(var(--text-muted))', opacity: 0.8 }} />
        </div>

        <div className="security-stat-card">
          <div className="stat-content">
            <div className="stat-label">Critical & High</div>
            <div className="stat-value" style={{ color: criticalCount > 0 ? '#f97316' : 'inherit' }}>
              {criticalCount}
            </div>
          </div>
          <Bug size={32} style={{ color: criticalCount > 0 ? '#f97316' : 'hsl(var(--text-muted))', opacity: 0.8 }} />
        </div>

        <div className="security-stat-card">
          <div className="stat-content">
            <div className="stat-label">В задачах разработчиков</div>
            <div className="stat-value" style={{ color: '#22c55e' }}>
              {promotedCount}
            </div>
          </div>
          <ArrowRightCircle size={32} style={{ color: '#22c55e', opacity: 0.8 }} />
        </div>

        <div className="security-stat-card">
          <div className="stat-content">
            <div className="stat-label">Всего зафиксировано</div>
            <div className="stat-value">
              {findings.length}
            </div>
          </div>
          <CheckCircle2 size={32} style={{ color: 'hsl(var(--primary))', opacity: 0.8 }} />
        </div>
      </div>

      {/* System Tabs Row */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'hsl(var(--text-secondary))', marginRight: '4px' }}>
          Вкладки систем / Сканеров:
        </span>
        <button
          className={`filter-btn ${systemTab === 'all' ? 'active' : ''}`}
          onClick={() => setSystemTab('all')}
          style={{ background: systemTab === 'all' ? 'hsl(var(--primary))' : undefined, color: systemTab === 'all' ? 'white' : undefined, fontWeight: 700 }}
        >
          🌐 Все системы ({accessibleFindings.length})
        </button>
        <button
          className={`filter-btn ${systemTab === 'derscanner' ? 'active' : ''}`}
          onClick={() => setSystemTab('derscanner')}
          style={{ background: systemTab === 'derscanner' ? '#ef4444' : undefined, color: systemTab === 'derscanner' ? 'white' : undefined, display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
        >
          🛡️ DerScanner SAST/DAST ({accessibleFindings.filter(f => f.source === 'derscanner').length})
          {!canAccessSystem('derscanner') && <span title="Ограничен по отделу">🔒</span>}
        </button>
        <button
          className={`filter-btn ${systemTab === 'siem' ? 'active' : ''}`}
          onClick={() => setSystemTab('siem')}
          style={{ background: systemTab === 'siem' ? '#3b82f6' : undefined, color: systemTab === 'siem' ? 'white' : undefined, display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
        >
          🚨 SIEM Monitor ({accessibleFindings.filter(f => f.source === 'siem').length})
          {!canAccessSystem('siem') && <span title="Ограничен по отделу">🔒</span>}
        </button>
        <button
          className={`filter-btn ${systemTab === 'waf' ? 'active' : ''}`}
          onClick={() => setSystemTab('waf')}
          style={{ background: systemTab === 'waf' ? '#f97316' : undefined, color: systemTab === 'waf' ? 'white' : undefined, display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
        >
          🔥 WAF Gateway ({accessibleFindings.filter(f => f.source === 'waf').length})
          {!canAccessSystem('waf') && <span title="Ограничен по отделу">🔒</span>}
        </button>
      </div>

      {/* Filters & Search */}
      <div className="security-filters-bar">
        <div className="filters-group">
          <button 
            className={`filter-btn ${statusFilter === 'active' ? 'active' : ''}`}
            onClick={() => setStatusFilter('active')}
          >
            🔥 Активные ({findings.filter(f => f.status === 'new' || f.status === 'analyzing').length})
          </button>
          <button 
            className={`filter-btn ${statusFilter === 'new' ? 'active' : ''}`}
            onClick={() => setStatusFilter('new')}
          >
            🆕 Новые ({findings.filter(f => f.status === 'new').length})
          </button>
          <button 
            className={`filter-btn ${statusFilter === 'analyzing' ? 'active' : ''}`}
            onClick={() => setStatusFilter('analyzing')}
          >
            🔍 В анализе ({findings.filter(f => f.status === 'analyzing').length})
          </button>
          <button 
            className={`filter-btn ${statusFilter === 'promoted' ? 'active' : ''}`}
            onClick={() => setStatusFilter('promoted')}
          >
            ➡️ В задачах ({findings.filter(f => f.status === 'promoted').length})
          </button>
          <button 
            className={`filter-btn ${statusFilter === 'false_positive' ? 'active' : ''}`}
            onClick={() => setStatusFilter('false_positive')}
          >
            ✅ Ложные ({findings.filter(f => f.status === 'false_positive').length})
          </button>
          <button 
            className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            📂 Все ({findings.length})
          </button>

          <span style={{ color: 'hsl(var(--border-color))', margin: '0 4px' }}>|</span>

          <select 
            className="input-field" 
            style={{ width: 'auto', margin: 0, padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem' }}
            value={severityFilter}
            onChange={e => setSeverityFilter(e.target.value)}
          >
            <option value="all">🛡️ Все критичности</option>
            <option value="Critical">🔴 Critical only</option>
            <option value="High">🟠 High only</option>
            <option value="Medium">🟡 Medium only</option>
            <option value="Low">🔵 Low only</option>
          </select>
        </div>

        <div style={{ position: 'relative', minWidth: '280px', flex: '1 1 300px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
          <input 
            type="text"
            className="input-field"
            style={{ width: '100%', margin: 0, paddingLeft: '36px', borderRadius: '20px' }}
            placeholder="Поиск по названию, CWE, файлу или проекту..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Findings List or Restricted Notice */}
      {systemTab !== 'all' && !canAccessSystem(systemTab) ? (
        <div style={{ textAlign: 'center', padding: '70px 20px', background: 'hsl(var(--card-bg))', borderRadius: '16px', border: '1px solid hsl(var(--border-color))', marginTop: '16px' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>🔒</div>
          <h3 style={{ fontSize: '1.4rem', marginBottom: '10px', color: 'hsl(var(--text-primary))' }}>Доступ к системе «{systemTab.toUpperCase()}» ограничен для вашего отдела</h3>
          <p style={{ color: 'hsl(var(--text-secondary))', maxWidth: '580px', margin: '0 auto 20px', lineHeight: '1.6' }}>
            Ваш текущий отдел (<strong>{currentUser?.department || 'Не указан'}</strong>) не имеет прав на просмотр алертов из данной системы мониторинга.<br />
            Права доступа к внешним сканерам и алертам безопасности настраиваются Администратором в разделе <strong>«⚙️ Панель Администратора &gt; 🔌 Интеграции & API-ключи»</strong>.
          </p>
        </div>
      ) : (
      <div className="findings-list">
        {filteredFindings.map(finding => (
          <div key={finding.id} className={`finding-card severity-${finding.severity}`}>
            <div className="finding-header">
              <div className="finding-title-section">
                <div className="finding-title">
                  <span className={`severity-pill ${finding.severity}`}>
                    <Bug size={14} />
                    {finding.severity}
                  </span>
                  <span>{finding.title}</span>
                  {finding.cwe && (
                    <code style={{ background: 'hsl(var(--bg-secondary))', padding: '2px 8px', borderRadius: '6px', fontSize: '0.8rem', color: 'hsl(var(--primary))' }}>
                      {finding.cwe}
                    </code>
                  )}
                </div>
                <div className="finding-meta">
                  {finding.project && (
                    <div className="finding-meta-item">
                      <FolderTree size={14} style={{ color: 'hsl(var(--primary))' }} />
                      <span>Проект: <strong>{finding.project}</strong></span>
                    </div>
                  )}
                  {finding.fileLocation && (
                    <div className="finding-meta-item">
                      <Code2 size={14} style={{ color: '#f97316' }} />
                      <span>Файл: <code>{finding.fileLocation}</code></span>
                    </div>
                  )}
                  <div className="finding-meta-item">
                    <span>Система: <strong style={{ color: finding.source === 'derscanner' ? '#ef4444' : '#3b82f6' }}>{finding.source === 'derscanner' ? '🛡️ DerScanner SAST' : finding.source?.toUpperCase()}</strong></span>
                  </div>
                  <div className="finding-meta-item">
                    <span>📅 {new Date(finding.createdAt).toLocaleString('ru-RU')}</span>
                  </div>
                </div>
              </div>

              <div>
                {finding.status === 'new' && <span className="status-badge new">🆕 Новый инцидент</span>}
                {finding.status === 'analyzing' && <span className="status-badge analyzing">🔍 В анализе ИБ</span>}
                {finding.status === 'promoted' && <span className="status-badge promoted">✅ В разработке JIRA</span>}
                {finding.status === 'false_positive' && <span className="status-badge false_positive">🚫 Ложное срабатывание</span>}
              </div>
            </div>

            {finding.description && (
              <div className="finding-body">
                {finding.description}
              </div>
            )}

            <div className="finding-footer">
              <div className="finding-actions">
                {finding.status !== 'promoted' && (
                  <button 
                    className="btn-primary" 
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '0.88rem' }}
                    onClick={() => setPromotingFinding(finding)}
                  >
                    <ArrowRightCircle size={16} />
                    ➡️ Передать в разработку (JIRA тикет)
                  </button>
                )}

                {finding.status === 'promoted' && finding.promotedTaskId && (
                  <button 
                    className="btn-secondary" 
                    style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', border: '1px solid #22c55e', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}
                    onClick={() => {
                      setActiveTaskModalId(finding.promotedTaskId || null);
                      if (finding.promotedTaskId) {
                        // Open task modal directly
                      } else {
                        setViewMode('board');
                      }
                    }}
                  >
                    <ExternalLink size={16} />
                    Открыть задачу: #{finding.promotedTaskId}
                  </button>
                )}

                {finding.status === 'new' && (
                  <button 
                    className="btn-secondary" 
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => updateFindingStatus(finding.id, 'analyzing')}
                  >
                    <Eye size={16} />
                    Взять на анализ
                  </button>
                )}

                {finding.status !== 'false_positive' && finding.status !== 'promoted' && (
                  <button 
                    className="btn-secondary" 
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8' }}
                    onClick={() => updateFindingStatus(finding.id, 'false_positive')}
                  >
                    <XCircle size={16} />
                    Ложное срабатывание
                  </button>
                )}

                {finding.status !== 'new' && (
                  <button 
                    className="btn-secondary" 
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => updateFindingStatus(finding.id, 'new')}
                  >
                    <RotateCcw size={16} />
                    Вернуть в новые
                  </button>
                )}
              </div>

              {isAdmin && (
                <button 
                  className="btn-icon-mini btn-icon-danger" 
                  onClick={() => {
                    if (window.confirm('Удалить эту запись об уязвимости из базы?')) {
                      deleteFinding(finding.id);
                    }
                  }}
                >
                  🗑️ Удалить
                </button>
              )}
            </div>
          </div>
        ))}

        {filteredFindings.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: 'hsl(var(--bg-card))', borderRadius: '16px', border: '1px solid hsl(var(--border-color))' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🛡️</div>
            <h3 style={{ color: 'hsl(var(--text-primary))', fontSize: '1.3rem', marginBottom: '8px' }}>
              Инцидентов не найдено
            </h3>
            <p style={{ color: 'hsl(var(--text-secondary))', maxWidth: '400px', margin: '0 auto' }}>
              Ни одна запись не соответствует выбранным фильтрам или все уязвимости успешно обработаны.
            </p>
          </div>
        )}
      </div>
      )}

      {/* Modal for Promoting Finding to Task */}
      {promotingFinding && (
        <div className="admin-modal-overlay" onClick={() => setPromotingFinding(null)}>
          <div className="promote-modal-card" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: '1.3rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🚀 Преобразование в задачу JIRA</span>
            </h2>
            <div style={{ background: 'hsl(var(--bg-secondary))', padding: '12px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>
              <strong>{promotingFinding.title}</strong><br />
              <span style={{ color: 'hsl(var(--text-secondary))' }}>
                {promotingFinding.project && `${promotingFinding.project} • `} 
                {promotingFinding.fileLocation || promotingFinding.cwe || 'SAST Alert'}
              </span>
            </div>

            <form onSubmit={handlePromoteSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Исполнитель разработчик</label>
                <select 
                  className="input-field" 
                  value={selectedAssignee} 
                  onChange={e => setSelectedAssignee(e.target.value)}
                  required
                >
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      👤 {u.name} ({u.role || u.department})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Спринт для выполнения</label>
                <select 
                  className="input-field" 
                  value={selectedSprint} 
                  onChange={e => setSelectedSprint(e.target.value)}
                >
                  <option value="unassigned">📥 Бэклог (Без спринта)</option>
                  {sprints.map(s => (
                    <option key={s.id} value={s.id}>
                      🏃 {s.name} ({s.isActive ? 'Активный' : 'Запланирован'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Приоритет задачи JIRA</label>
                <select 
                  className="input-field" 
                  value={selectedPriority} 
                  onChange={e => setSelectedPriority(e.target.value)}
                >
                  <option value="highest">🔴 Highest (Критический блокировщик)</option>
                  <option value="high">🟠 High (Высокий)</option>
                  <option value="medium">🟡 Medium (Средний)</option>
                  <option value="low">🔵 Low (Низкий)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button type="button" className="btn-secondary" onClick={() => setPromotingFinding(null)}>
                  Отмена
                </button>
                <button type="submit" className="btn-primary" disabled={isPromoting}>
                  {isPromoting ? 'Создание...' : '✨ Создать тикет и связать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
