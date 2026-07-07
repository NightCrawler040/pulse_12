import React, { useState } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import type { Status, Priority, Task } from '../../types';
import { Plus, ChevronDown, ChevronRight } from 'lucide-react';
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
    groups,
    filters,
    filteredTasks,
    addSprint,
    updateSprint,
    deleteSprint
  } = useTaskContext();

  const { currentUser, isAdmin } = useAuth();

  const displayTasks = React.useMemo(() => {
    return filteredTasks.filter(task => {
      if (filters.myTasksOnly && currentUser && !isAdmin) {
        const isAssignee = task.assigneeId === currentUser.id;
        const inGroup = task.assigneeGroupId && groups ? groups.some(g => g.id === task.assigneeGroupId && g.memberIds?.includes(currentUser.id)) : false;
        const isCommenter = task.comments ? task.comments.some(c => c.userId === currentUser.id) : false;
        if (!isAssignee && !inGroup && !isCommenter) {
          return false;
        }
      }
      return true;
    });
  }, [filteredTasks, filters.myTasksOnly, currentUser, groups]);

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
    setSprintIsActive(sprints.length === 0);
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

  const renderTaskTable = (taskList: Task[], groupName: string, sprintId: string | null, sprintObj?: any) => {
    const isCollapsed = collapsedSprints[sprintId || 'backlog'];
    const totalSP = taskList.reduce((sum, t) => sum + (t.storyPoints || 0), 0);

    return (
      <div className="backlog-section glass-panel" key={sprintId || 'backlog'}>
        <div className="backlog-header" onClick={() => toggleSprintCollapse(sprintId || 'backlog')}>
          <div className="backlog-title-row">
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
            <h3 className="backlog-section-title">{groupName}</h3>
            <span className="backlog-count">{taskList.length} задач</span>
            <span className="backlog-sp">{totalSP} SP</span>
          </div>

          <div className="backlog-header-actions" onClick={e => e.stopPropagation()}>
            {sprintId && (
              <button 
                className="btn-secondary btn-sm"
                onClick={() => {
                  setActiveSprintId(sprintId);
                  alert(`Переключено на спринт: ${groupName}`);
                }}
              >
                К доске спринта
              </button>
            )}
            {sprintObj && (
              <>
                <button 
                  className="btn-secondary btn-sm" 
                  onClick={e => openEditSprintModal(sprintObj, e)}
                  title="Редактировать спринт"
                >
                  ✏️
                </button>
                <button 
                  className="btn-danger btn-sm" 
                  onClick={e => handleDeleteSprint(sprintObj.id, sprintObj.name, e)}
                  title="Удалить спринт"
                  style={{ padding: '4px 8px', minWidth: 'auto' }}
                >
                  🗑️
                </button>
              </>
            )}
            <button className="btn-primary btn-sm" onClick={() => onOpenNewTaskModal(sprintId)}>
              <Plus size={14} /> Создать задачу
            </button>
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
                  <th style={{ width: '150px' }}>Спринт</th>
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
                            {task.tags.slice(0, 3).map((t, i) => (
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
                              <img src={assignee.avatar} alt={assignee.name} className="mini-avatar" />
                              <span className="assignee-name-sm">{assignee.name}</span>
                            </div>
                          ) : (
                            <span className="unassigned-sm">Не назначен</span>
                          )}
                        </td>
                        <td className="cell-sprint" onClick={e => e.stopPropagation()}>
                          <select
                            value={task.sprintId || ''}
                            onChange={e => handleSprintChange(e, task.id, e as any)}
                            className="table-select sprint-select-sm"
                          >
                            <option value="">-- Бэклог --</option>
                            {sprints.map(s => (
                              <option key={s.id} value={s.id}>{s.name.slice(0, 18)}...</option>
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
          <h2 className="backlog-page-title">Бэклог и Управление Спринтами</h2>
          <p className="backlog-page-subtitle">
            Планируйте спринты, оценивайте сложность задач в Story Points и перемещайте задачи между итерациями.
          </p>
        </div>
        <button className="btn-primary" onClick={openNewSprintModal} style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '38px' }}>
          <Plus size={16} /> Создать новый спринт
        </button>
      </div>

      <div className="glass-panel" style={{ padding: '14px 18px', marginBottom: '20px', borderRadius: '10px', borderLeft: '4px solid var(--primary-color)', background: 'rgba(59, 130, 246, 0.05)' }}>
        <div style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          💡 Как работают Бэклог и Спринты?
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
          <strong>Общий Бэклог</strong> — это копилка всех ваших идей, будущих планов и входящих задач, которые еще не взяты в работу. <br />
          <strong>Спринт</strong> — это временной отрезок (например, 1-2 недели), куда руководитель или команда отбирает задачи из Бэклога. Вы можете создавать новые спринты, ставить им цели и переключаться между их досками!
        </div>
      </div>

      <div className="backlog-sections-list">
        {/* Active Sprints */}
        {sprints.map(sprint => {
          const sprintTasks = displayTasks.filter(t => t.sprintId === sprint.id);
          const name = `${sprint.name} ${sprint.isActive ? '(🔥 Активный спринт)' : ''}`;
          return renderTaskTable(sprintTasks, name, sprint.id, sprint);
        })}

        {/* Unscheduled Backlog */}
        {renderTaskTable(backlogTasks, '📋 Общий Бэклог (Задачи без спринта)', null)}
      </div>

      {/* Sprint Creation / Editing Modal */}
      {isSprintModalOpen && (
        <div className="modal-overlay" onClick={() => setIsSprintModalOpen(false)}>
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
                  placeholder="Например: Спринт 15: Релиз мобильного интерфейса"
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
