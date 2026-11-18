import React, { useState } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/api';
import type { Status, Priority, Task } from '../../types';
import { Plus, ChevronDown, ChevronRight, Archive, Download, RotateCcw, FileText } from 'lucide-react';
import './Backlog.css';

interface BacklogProps {
  onOpenNewTaskModal: (sprintId?: string | null) => void;
}

export const Backlog: React.FC<BacklogProps> = ({ onOpenNewTaskModal }) => {
  const { 
    sprints, 
    users, 
    columns, 
    updateTask, 
    setActiveTaskModalId,
    setActiveSprintId,
    setViewMode,
    groups,
    filters,
    filteredTasks,
    addSprint,
    updateSprint,
    deleteSprint,
    completeSprint
  } = useTaskContext();

  const { currentUser, isAdmin, isManagerOrAdmin } = useAuth();
  const [backlogTab, setBacklogTab] = useState<'active' | 'archive'>('active');

  const displayTasks = React.useMemo(() => {
    return filteredTasks.filter(task => {
      const shouldFilterByMe = (!isManagerOrAdmin && currentUser) || (isManagerOrAdmin && currentUser && filters.myTasksOnly);
      if (shouldFilterByMe) {
        const isAssignee = task.assigneeId === currentUser.id;
        const inGroup = task.assigneeGroupId && groups ? groups.some(g => g.id === task.assigneeGroupId && g.memberIds?.includes(currentUser.id)) : false;
        const isCommenter = task.comments ? task.comments.some(c => c.userId === currentUser.id) : false;
        const isCreator = task.creatorId === currentUser.id;
        if (!isAssignee && !inGroup && !isCommenter && !isCreator) {
          return false;
        }
      }
      return true;
    });
  }, [filteredTasks, filters.myTasksOnly, currentUser, groups, isAdmin, isManagerOrAdmin]);

  const activeSprints = React.useMemo(() => sprints.filter(s => !s.isArchived), [sprints]);
  const archivedSprints = React.useMemo(() => sprints.filter(s => s.isArchived), [sprints]);

  const [collapsedSprints, setCollapsedSprints] = useState<Record<string, boolean>>({});

  // Sprint Modal State
  const [isSprintModalOpen, setIsSprintModalOpen] = useState(false);
  const [editingSprintId, setEditingSprintId] = useState<string | null>(null);
  const [sprintName, setSprintName] = useState('');
  const [sprintStartDate, setSprintStartDate] = useState('');
  const [sprintEndDate, setSprintEndDate] = useState('');
  const [sprintGoal, setSprintGoal] = useState('');
  const [sprintIsActive, setSprintIsActive] = useState(false);

  const toggleSprintCollapse = (sprintId: string) => {
    setCollapsedSprints(prev => ({ ...prev, [sprintId]: !prev[sprintId] }));
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>, taskId: string, eStop: React.MouseEvent) => {
    eStop.stopPropagation();
    updateTask(taskId, { status: e.target.value as Status });
  };

  const handlePriorityChange = (e: React.ChangeEvent<HTMLSelectElement>, taskId: string, eStop: React.MouseEvent) => {
    eStop.stopPropagation();
    updateTask(taskId, { priority: e.target.value as Priority });
  };

  const handleSprintChange = (e: React.ChangeEvent<HTMLSelectElement>, taskId: string, eStop: React.MouseEvent) => {
    eStop.stopPropagation();
    const val = e.target.value || null;
    updateTask(taskId, { sprintId: val });
  };

  const openNewSprintModal = () => {
    setEditingSprintId(null);
    setSprintName(`Спринт ${sprints.length + 1}: Название итерации`);
    const today = new Date().toISOString().slice(0, 10);
    const twoWeeks = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    setSprintStartDate(today);
    setSprintEndDate(twoWeeks);
    setSprintGoal('');
    setSprintIsActive(activeSprints.length === 0);
    setIsSprintModalOpen(true);
  };

  const openEditSprintModal = (sprint: any, eStop: React.MouseEvent) => {
    eStop.stopPropagation();
    setEditingSprintId(sprint.id);
    setSprintName(sprint.name);
    setSprintStartDate(sprint.startDate || '');
    setSprintEndDate(sprint.endDate || '');
    setSprintGoal(sprint.goal || '');
    setSprintIsActive(sprint.isActive || false);
    setIsSprintModalOpen(true);
  };

  const handleSaveSprint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sprintName.trim()) {
      alert('Пожалуйста, введите название спринта');
      return;
    }
    if (editingSprintId) {
      updateSprint(editingSprintId, {
        name: sprintName,
        startDate: sprintStartDate,
        endDate: sprintEndDate,
        goal: sprintGoal,
        isActive: sprintIsActive
      });
    } else {
      addSprint({
        name: sprintName,
        startDate: sprintStartDate,
        endDate: sprintEndDate,
        goal: sprintGoal,
        isActive: sprintIsActive
      });
    }
    setIsSprintModalOpen(false);
  };

  const handleDeleteSprint = (sprintId: string, sprintName: string, eStop: React.MouseEvent) => {
    eStop.stopPropagation();
    if (window.confirm(`Вы уверены, что хотите удалить спринт "${sprintName}"? Все задачи из него вернутся в общий Бэклог.`)) {
      deleteSprint(sprintId);
    }
  };

  const handleCompleteSprint = async (sprintObj: any, eStop: React.MouseEvent) => {
    eStop.stopPropagation();
    if (!isManagerOrAdmin) return;
    const candidates = sprints.filter(s => s.id !== sprintObj.id && !s.isArchived && s.workspaceId === sprintObj.workspaceId);
    let targetId: string | null = 'backlog';
    if (candidates.length > 0) {
      const list = candidates.map((s, i) => `${i + 1} — ${s.name}`).join('\n');
      const ans = window.prompt(
        `Завершить и создать бэкап спринта "${sprintObj.name}"?\n` +
        `Куда перенести незавершённые задачи?\n` +
        `0 — Вернуть в Общий Бэклог\n` +
        `Пусто — Оставить в архиве спринта\n` +
        `${list}`,
        '0'
      );
      if (ans === null) return;
      if (ans.trim() === '') {
        targetId = null;
      } else if (ans.trim() === '0') {
        targetId = 'backlog';
      } else {
        const idx = parseInt(ans, 10) - 1;
        if (!isNaN(idx) && candidates[idx]) targetId = candidates[idx].id;
      }
    } else if (!window.confirm(`Завершить спринт "${sprintObj.name}" и сохранить его неизменяемый бэкап в Архиве спринтов?`)) {
      return;
    }
    try {
      const r: any = await completeSprint(sprintObj.id, targetId);
      alert(`✅ Спринт "${sprintObj.name}" успешно завершён и перенесён в Архив!\nВыполнено задач: ${r.stats.completed} из ${r.stats.total}\nПеренесено незавершённых: ${r.stats.moved}\nСоздан файл бэкапа: ${r.backupFilename || 'сохранен на сервере'}`);
    } catch (err: any) {
      alert(err?.message || 'Не удалось завершить спринт');
    }
  };

  const handleRestoreSprintFromArchive = (sprintObj: any, eStop: React.MouseEvent) => {
    eStop.stopPropagation();
    if (!window.confirm(`Вернуть спринт "${sprintObj.name}" из архива обратно в активные спринты?`)) return;
    updateSprint(sprintObj.id, { isArchived: false, isActive: false });
  };

  const handleDownloadSprintBackupJson = (sprintObj: any, taskList: Task[], eStop: React.MouseEvent) => {
    eStop.stopPropagation();
    const payload = {
      sprint: sprintObj,
      exportedAt: new Date().toISOString(),
      tasksCount: taskList.length,
      tasks: taskList
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `sprint_backup_${sprintObj.id}_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSprintPdf = (sprintObj: any, eStop: React.MouseEvent) => {
    eStop.stopPropagation();
    apiService.downloadPdf(`/api/reports/pdf?sprintId=${sprintObj.id}`, `Pulse12_Sprint_${sprintObj.name.replace(/\s+/g, '_')}.pdf`);
  };

  const renderTaskTable = (taskList: Task[], groupName: string, sprintId: string | null, sprintObj?: any) => {
    const isCollapsed = collapsedSprints[sprintId || 'backlog'];
    const totalSP = taskList.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    const completedCount = taskList.filter(t => t.status === 'done').length;

    return (
      <div className="backlog-section glass-panel" key={sprintId || 'backlog'} style={sprintObj?.isArchived ? { borderLeft: '4px solid #64748b' } : undefined}>
        <div className="backlog-header" onClick={() => toggleSprintCollapse(sprintId || 'backlog')}>
          <div className="backlog-title-row" style={{ flexWrap: 'wrap', gap: '8px' }}>
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
            <h3 className="backlog-section-title">{groupName}</h3>
            <span className="backlog-count">{taskList.length} задач (выполнено: {completedCount})</span>
            <span className="backlog-sp">{totalSP} SP</span>
            {sprintObj?.archivedAt && (
              <span style={{ fontSize: '0.75rem', background: 'rgba(100,116,139,0.2)', color: '#94a3b8', padding: '2px 8px', borderRadius: '6px' }}>
                🗄️ В архиве с {new Date(sprintObj.archivedAt).toLocaleDateString('ru-RU')}
              </span>
            )}
          </div>

          <div className="backlog-header-actions" onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {sprintId && (
              <button 
                className="btn-secondary btn-sm"
                onClick={() => {
                  setActiveSprintId(sprintId);
                  setViewMode('board');
                }}
              >
                📋 Открыть на доске
              </button>
            )}
            {sprintObj && (
              <>
                <button
                  className="btn-secondary btn-sm"
                  onClick={e => handleDownloadSprintPdf(sprintObj, e)}
                  title="Скачать официальный PDF-отчет по спринту"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <FileText size={13} /> PDF
                </button>
                <button
                  className="btn-secondary btn-sm"
                  onClick={e => handleDownloadSprintBackupJson(sprintObj, taskList, e)}
                  title="Скачать JSON-бэкап спринта со всеми задачами"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Download size={13} /> Бэкап JSON
                </button>
                {!sprintObj.isArchived && (
                  <button 
                    className="btn-secondary btn-sm" 
                    onClick={e => openEditSprintModal(sprintObj, e)}
                    title="Редактировать спринт"
                  >
                    ✏️
                  </button>
                )}
                {isManagerOrAdmin && !sprintObj.isArchived && (
                  <button
                    className="btn-secondary btn-sm"
                    onClick={e => handleCompleteSprint(sprintObj, e)}
                    title="Завершить спринт и сохранить в архив"
                    style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', borderColor: 'rgba(16,185,129,0.4)' }}
                  >
                    ✅ Завершить в Архив
                  </button>
                )}
                {isManagerOrAdmin && sprintObj.isArchived && (
                  <button
                    className="btn-secondary btn-sm"
                    onClick={e => handleRestoreSprintFromArchive(sprintObj, e)}
                    title="Вернуть спринт из архива"
                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <RotateCcw size={13} /> Вернуть из архива
                  </button>
                )}
                {isManagerOrAdmin && (
                  <button 
                    className="btn-danger btn-sm" 
                    onClick={e => handleDeleteSprint(sprintObj.id, sprintObj.name, e)}
                    title="Удалить спринт"
                    style={{ padding: '4px 8px', minWidth: 'auto' }}
                  >
                    🗑️
                  </button>
                )}
              </>
            )}
            {(!sprintObj || !sprintObj.isArchived) && (
              <button className="btn-primary btn-sm" onClick={() => onOpenNewTaskModal(sprintId)}>
                <Plus size={14} /> Создать задачу
              </button>
            )}
          </div>
        </div>

        {sprintObj && sprintObj.goal && !isCollapsed && (
          <div style={{ padding: '0 16px 10px', fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
            🎯 <strong>Цель спринта:</strong> {sprintObj.goal}
            {sprintObj.startDate && sprintObj.endDate && ` (${sprintObj.startDate} — ${sprintObj.endDate})`}
          </div>
        )}

        {!isCollapsed && (
          <div className="table-responsive">
            <table className="backlog-table">
              <thead>
                <tr>
                  <th style={{ width: '100px' }}>ID</th>
                  <th>Название</th>
                  <th style={{ width: '150px' }}>Статус</th>
                  <th style={{ width: '140px' }}>Приоритет</th>
                  <th style={{ width: '180px' }}>Исполнитель</th>
                  <th style={{ width: '170px' }}>Спринт</th>
                  <th style={{ width: '80px' }}>SP</th>
                </tr>
              </thead>
              <tbody>
                {taskList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-row">В этом разделе пока нет задач</td>
                  </tr>
                ) : (
                  taskList.map(task => {
                    const assignee = users.find(u => u.id === task.assigneeId);
                    return (
                      <tr 
                        key={task.id} 
                        className="backlog-row"
                        onClick={() => setActiveTaskModalId(task.id)}
                      >
                        <td className="cell-id">{task.id}</td>
                        <td className="cell-title">
                          <span className="task-title-text">{task.title}</span>
                          <div className="cell-tags">
                            {(task.tags || []).slice(0, 3).map((t, i) => (
                              <span key={i} className="mini-tag">#{t}</span>
                            ))}
                          </div>
                        </td>
                        <td className="cell-status" onClick={e => e.stopPropagation()}>
                          <select
                            value={task.status}
                            onChange={e => handleStatusChange(e, task.id, e as any)}
                            className={`table-select status-${task.status}`}
                          >
                            {columns.map(c => (
                              <option key={c.id} value={c.id}>{c.title}</option>
                            ))}
                          </select>
                        </td>
                        <td className="cell-priority" onClick={e => e.stopPropagation()}>
                          <select
                            value={task.priority}
                            onChange={e => handlePriorityChange(e, task.id, e as any)}
                            className={`table-select priority-${task.priority}`}
                          >
                            <option value="low">Низкий</option>
                            <option value="medium">Средний</option>
                            <option value="high">Высокий</option>
                            <option value="urgent">🔥 Срочно!</option>
                          </select>
                        </td>
                        <td className="cell-assignee">
                          {assignee ? (
                            <div className="assignee-cell">
                              <img src={assignee.avatar} alt={assignee.name || assignee.login} className="mini-avatar" />
                              <span className="assignee-name-sm">{assignee.name || assignee.login || assignee.id}</span>
                            </div>
                          ) : task.assigneeGroupId && groups.find(g => g.id === task.assigneeGroupId) ? (
                            <div className="assignee-cell">
                              <div className="mini-avatar" style={{ backgroundColor: groups.find(g => g.id === task.assigneeGroupId)?.color || '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px' }}>👥</div>
                              <span className="assignee-name-sm">{groups.find(g => g.id === task.assigneeGroupId)?.name}</span>
                            </div>
                          ) : (
                            <span className="unassigned-sm">Не назначен</span>
                          )}
                        </td>
                        <td className="cell-sprint" onClick={e => e.stopPropagation()}>
                          <select
                            value={task.sprintId === 'unassigned' ? '' : (task.sprintId || '')}
                            onChange={e => handleSprintChange(e, task.id, e as any)}
                            className="table-select sprint-select-sm"
                          >
                            <option value="">-- Общий Бэклог --</option>
                            {activeSprints.map(s => (
                              <option key={s.id} value={s.id}>{(s.name || 'Спринт').slice(0, 22)}</option>
                            ))}
                            {archivedSprints.map(s => (
                              <option key={s.id} value={s.id}>🗄️ {(s.name || 'Архив').slice(0, 18)}</option>
                            ))}
                          </select>
                        </td>
                        <td className="cell-sp">
                          <span className="sp-pill">{task.storyPoints}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const backlogTasks = displayTasks.filter(t => !t.sprintId || t.sprintId === 'unassigned');

  return (
    <div className="backlog-container animate-fade-in">
      <div className="backlog-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 className="backlog-page-title">Бэклог, Спринты и Архив Итераций</h2>
          <p className="backlog-page-subtitle">
            Планируйте текущие спринты и храните завершённые спринты в изолированном Архиве с возможностью выгрузки PDF и JSON-бэкапов.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: 'hsl(var(--bg-secondary))', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
            <button
              onClick={() => setBacklogTab('active')}
              style={{
                padding: '8px 16px',
                background: backlogTab === 'active' ? 'hsl(var(--primary))' : 'transparent',
                color: backlogTab === 'active' ? '#fff' : 'hsl(var(--text-secondary))',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem'
              }}
            >
              🚀 Активные спринты и Бэклог ({activeSprints.length})
            </button>
            <button
              onClick={() => setBacklogTab('archive')}
              style={{
                padding: '8px 16px',
                background: backlogTab === 'archive' ? 'hsl(var(--primary))' : 'transparent',
                color: backlogTab === 'archive' ? '#fff' : 'hsl(var(--text-secondary))',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Archive size={15} /> Архив и Бэкапы спринтов ({archivedSprints.length})
            </button>
          </div>
          {backlogTab === 'active' && (
            <button className="btn-primary" onClick={openNewSprintModal} style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '38px' }}>
              <Plus size={16} /> Создать новый спринт
            </button>
          )}
        </div>
      </div>

      {backlogTab === 'active' ? (
        <div className="backlog-sections-list">
          {activeSprints.map(sprint => {
            const sprintTasks = displayTasks.filter(t => t.sprintId === sprint.id);
            const name = `${sprint.name} ${sprint.isActive ? '(🔥 Активный спринт)' : ''}`;
            return renderTaskTable(sprintTasks, name, sprint.id, sprint);
          })}

          {renderTaskTable(backlogTasks, '📋 Общий Бэклог (Оперативные задачи вне спринта)', null)}
        </div>
      ) : (
        <div className="backlog-sections-list">
          <div className="glass-panel" style={{ padding: '14px 18px', marginBottom: '16px', borderRadius: '10px', borderLeft: '4px solid #64748b', background: 'rgba(100, 116, 139, 0.08)' }}>
            <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--text-color)' }}>
              🗄️ Изолированный Архив завершённых спринтов
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Задачи из завершённых спринтов скрыты с главной Канбан-доски, чтобы не засорять текущую работу. Вы можете в любой момент открыть архивный спринт, скачать его PDF-отчёт, выгрузить JSON-бэкап или вернуть задачу в работу.
            </div>
          </div>
          {archivedSprints.length === 0 ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Пока нет завершённых спринтов в архиве. Нажмите «✅ Завершить в Архив» у любого спринта, когда его итерация подойдёт к концу.
            </div>
          ) : (
            archivedSprints.map(sprint => {
              const sprintTasks = displayTasks.filter(t => t.sprintId === sprint.id);
              return renderTaskTable(sprintTasks, `🗄️ ${sprint.name}`, sprint.id, sprint);
            })
          )}
        </div>
      )}

      {isSprintModalOpen && (
        <div className="modal-overlay" onClick={() => setIsSprintModalOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="modal-content glass-panel" style={{ maxWidth: '500px', width: '90%', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', color: 'var(--text-color)' }}>
              {editingSprintId ? '✏️ Редактирование спринта' : '➕ Создание нового спринта'}
            </h3>
            <form onSubmit={handleSaveSprint} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Название спринта *
                </label>
                <input 
                  type="text" 
                  value={sprintName} 
                  onChange={e => setSprintName(e.target.value)} 
                  required
                  placeholder="Например: Спринт 15: Аудит периметра ИБ"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-color)', fontSize: '14px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    Дата начала
                  </label>
                  <input 
                    type="date" 
                    value={sprintStartDate} 
                    onChange={e => setSprintStartDate(e.target.value)} 
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-color)', fontSize: '14px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    Дата окончания
                  </label>
                  <input 
                    type="date" 
                    value={sprintEndDate} 
                    onChange={e => setSprintEndDate(e.target.value)} 
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-color)', fontSize: '14px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  🎯 Цель спринта
                </label>
                <textarea 
                  value={sprintGoal} 
                  onChange={e => setSprintGoal(e.target.value)} 
                  rows={3}
                  placeholder="Кратко опишите, какого результата должна достичь команда за этот спринт..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-color)', fontSize: '14px', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <input 
                  type="checkbox" 
                  id="sprintIsActive"
                  checked={sprintIsActive} 
                  onChange={e => setSprintIsActive(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="sprintIsActive" style={{ fontSize: '14px', cursor: 'pointer', color: 'var(--text-color)', fontWeight: 500 }}>
                  Сделать этот спринт текущим активным на доске задач
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsSprintModalOpen(false)}>
                  Отмена
                </button>
                <button type="submit" className="btn-primary">
                  {editingSprintId ? 'Сохранить изменения' : 'Создать спринт'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
