import React, { useState } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import type { Status, Priority, Task } from '../../types';
import { Plus, ChevronDown, ChevronRight } from 'lucide-react';
import './Backlog.css';

interface BacklogProps {
  onOpenNewTaskModal: () => void;
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
    filteredTasks
  } = useTaskContext();

  const { currentUser } = useAuth();

  const displayTasks = React.useMemo(() => {
    return filteredTasks.filter(task => {
      if (filters.myTasksOnly && currentUser) {
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

  const renderTaskTable = (taskList: Task[], groupName: string, sprintId: string | null) => {
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
            <button className="btn-primary btn-sm" onClick={onOpenNewTaskModal}>
              <Plus size={14} /> Создать
            </button>
          </div>
        </div>

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

  const backlogTasks = displayTasks.filter(t => !t.sprintId);

  return (
    <div className="backlog-container animate-fade-in">
      <div className="backlog-page-header">
        <div>
          <h2 className="backlog-page-title">Бэклог и Управление Спринтами</h2>
          <p className="backlog-page-subtitle">
            Планируйте спринты, оценивайте сложность задач в Story Points и перемещайте задачи между итерациями.
          </p>
        </div>
      </div>

      <div className="backlog-sections-list">
        {/* Active Sprints */}
        {sprints.map(sprint => {
          const sprintTasks = displayTasks.filter(t => t.sprintId === sprint.id);
          const name = `${sprint.name} ${sprint.isActive ? '(Активный)' : ''}`;
          return renderTaskTable(sprintTasks, name, sprint.id);
        })}

        {/* Unscheduled Backlog */}
        {renderTaskTable(backlogTasks, '📋 Общий Бэклог (Без спринта)', null)}
      </div>
    </div>
  );
};
