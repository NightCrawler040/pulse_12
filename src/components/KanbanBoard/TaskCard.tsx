import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import type { Task, User } from '../../types';
import { Clock, CheckSquare, MessageSquare, Paperclip, AlertCircle } from 'lucide-react';
import './KanbanBoard.css';

interface TaskCardProps {
  task: Task;
  index: number;
  users: User[];
  groups?: any[];
  onCardClick: (taskId: string) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, index, users, groups, onCardClick }) => {
  const assignee = users.find(u => u.id === task.assigneeId);
  const groupAssignee = groups?.find(g => g.id === task.assigneeGroupId);

  const completedSubtasks = (task.subtasks || []).filter(s => s.completed).length;
  const totalSubtasks = (task.subtasks || []).length;

  const priorityLabels: Record<string, string> = {
    low: 'Низкий',
    medium: 'Средний',
    high: 'Высокий',
    urgent: 'Срочно!'
  };

  // SLA & Deadline calculation
  const slaBadge = React.useMemo(() => {
    if (task.status === 'done') return null;
    if (!task.dueDate) return null;
    const dueTime = new Date(task.dueDate).getTime();
    if (isNaN(dueTime)) return null;
    const now = Date.now();
    const diffHours = (dueTime - now) / (1000 * 60 * 60);
    if (diffHours < -24) {
      const daysOverdue = Math.ceil(Math.abs(diffHours) / 24);
      return {
        label: `🔥 Просрочено (${daysOverdue} дн.)`,
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.16)',
        border: 'rgba(239, 68, 68, 0.45)',
        isOverdue: true
      };
    }
    if (diffHours <= 24) {
      return {
        label: '⏳ Дедлайн сегодня',
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.16)',
        border: 'rgba(245, 158, 11, 0.45)',
        isOverdue: false
      };
    }
    return null;
  }, [task.dueDate, task.status]);

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`task-card ${snapshot.isDragging ? 'is-dragging' : ''}`}
          onClick={() => onCardClick(task.id)}
          style={{
            ...provided.draggableProps.style,
            borderColor: slaBadge?.isOverdue ? 'rgba(239, 68, 68, 0.5)' : undefined,
            boxShadow: slaBadge?.isOverdue ? '0 0 14px rgba(239, 68, 68, 0.15)' : undefined
          }}
        >
          {/* Top Row: Task ID & Priority */}
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span className="task-id">{task.id}</span>
              {(task.externalFindingId || task.tags?.some(t => String(t).toLowerCase() === 'derscanner')) && !task.tags?.some(t => String(t).toLowerCase() === 'siem' || String(t).toLowerCase() === 'waf') && (
                <span style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  padding: '2px 6px',
                  borderRadius: '6px',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }} title="Задача создана автоматически из уязвимости DerScanner SAST">
                  🛡️ DerScanner
                </span>
              )}
              {task.tags?.some(t => String(t).toLowerCase() === 'kz-cert') && (
                <span style={{
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  padding: '2px 6px',
                  borderRadius: '6px',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }} title="Бюллетень KZ-CERT SOAR">
                  📧 KZ-CERT
                </span>
              )}
              {task.tags?.some(t => String(t).toLowerCase() === 'siem') && (
                <span style={{
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#3b82f6',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  padding: '2px 6px',
                  borderRadius: '6px',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }} title="Задача создана по алерту SIEM">
                  🛡️ SIEM
                </span>
              )}
              {task.tags?.some(t => String(t).toLowerCase() === 'waf') && (
                <span style={{
                  background: 'rgba(249, 115, 22, 0.15)',
                  color: '#f97316',
                  border: '1px solid rgba(249, 115, 22, 0.4)',
                  padding: '2px 6px',
                  borderRadius: '6px',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }} title="Задача создана по событию WAF">
                  🛡️ WAF
                </span>
              )}
            </div>
            <span className={`priority-badge priority-${task.priority}`}>
              {priorityLabels[task.priority]}
            </span>
          </div>

          {/* SLA Alert Pill */}
          {slaBadge && (
            <div style={{
              marginTop: '6px',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '0.7rem',
              fontWeight: 700,
              background: slaBadge.bg,
              color: slaBadge.color,
              border: `1px solid ${slaBadge.border}`,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <AlertCircle size={12} />
              <span>{slaBadge.label}</span>
            </div>
          )}

          {/* Project Badge */}
          {(task.project || task.externalFindingId) && (
            <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#60a5fa', margin: '4px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>🏢</span>
              <span>Проект: {task.project || 'PULSE'}</span>
            </div>
          )}

          {/* Title */}
          <h4 className="task-title">{task.title}</h4>

          {/* Tags */}
          {Array.isArray(task.tags) && task.tags.length > 0 && (
            <div className="task-tags">
              {task.tags.map((tag, idx) => (
                <span key={idx} className="tag-pill">#{tag}</span>
              ))}
            </div>
          )}

          {/* Mini Subtask Progress Bar */}
          {totalSubtasks > 0 && (
            <div style={{ marginTop: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'hsl(var(--text-secondary))', marginBottom: '3px' }}>
                <span>Чек-лист</span>
                <span style={{ fontWeight: 700, color: completedSubtasks === totalSubtasks ? '#10b981' : 'inherit' }}>
                  {Math.round((completedSubtasks / totalSubtasks) * 100)}% ({completedSubtasks}/{totalSubtasks})
                </span>
              </div>
              <div className="card-mini-progress">
                <div 
                  className="card-mini-progress-fill" 
                  style={{
                    width: `${Math.round((completedSubtasks / totalSubtasks) * 100)}%`,
                    background: completedSubtasks === totalSubtasks ? '#10b981' : 'hsl(var(--primary))'
                  }} 
                />
              </div>
            </div>
          )}

          {/* Progress / Stats Row */}
          <div className="task-stats-row">
            {totalSubtasks > 0 && (
              <div className="stat-item" title="Подзадачи">
                <CheckSquare size={13} className={completedSubtasks === totalSubtasks ? 'text-success' : ''} />
                <span>{completedSubtasks}/{totalSubtasks}</span>
              </div>
            )}

            {task.attachments && task.attachments.length > 0 && (
              <div className="stat-item" title="Вложения и документы">
                <Paperclip size={13} />
                <span>{task.attachments.length}</span>
              </div>
            )}

            {task.comments && task.comments.length > 0 && (
              <div className="stat-item" title="Комментарии">
                <MessageSquare size={13} />
                <span>{task.comments.length}</span>
              </div>
            )}

            {(task.estimatedHours > 0 || task.loggedHours > 0) && (
              <div className="stat-item" title="Затрачено / Оценка (часы)">
                <Clock size={13} />
                <span>{task.loggedHours}ч/{task.estimatedHours}ч</span>
              </div>
            )}
          </div>

          {/* Due Date & Creator Info */}
          {(task.dueDate || task.creatorName) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {task.creatorName && (
                <span title={`Создатель задачи: ${task.creatorName}`}>
                  От: {
                    task.creatorName.split(' ').map((p, i) => i === 0 ? p : p[0].toUpperCase() + '.').join(' ')
                  }
                </span>
              )}
              {task.dueDate && (
                <span style={{ color: slaBadge?.color || '#f59e0b', fontWeight: 600 }} title="Срок выполнения">
                  До {task.dueDate}
                </span>
              )}
            </div>
          )}

          {/* Bottom Row: Assignee Avatar & Story Points */}
          <div className="card-footer">
            <div className="assignee-info">
              {assignee ? (
                <div className="avatar-small-wrapper" title={`Исполнитель: ${assignee.name || assignee.login || assignee.id} (${assignee.role || 'Пользователь'})`}>
                  {assignee.avatar ? (
                    <img src={assignee.avatar} alt="" className="user-avatar-img" />
                  ) : (
                    <div className="user-avatar-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#e2e8f0', color: '#64748b', borderRadius: '50%', width: '100%', height: '100%', fontSize: '0.7rem', fontWeight: 600 }}>
                      {((assignee.name || assignee.login || '?')[0]).toUpperCase()}
                    </div>
                  )}
                </div>
              ) : groupAssignee ? (
                <div className="avatar-small-wrapper" title={`Команда: ${groupAssignee.name}`}>
                  <div className="user-avatar-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: groupAssignee.color || '#3b82f6', color: '#ffffff', borderRadius: '50%', width: '100%', height: '100%', fontSize: '0.8rem', fontWeight: 600 }}>
                    👥
                  </div>
                </div>
              ) : (
                <span className="unassigned-badge">Не назначен</span>
              )}
              {assignee && (
                <span className="assignee-name" style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {assignee.name.split(' ')[0]}
                </span>
              )}
            </div>

            {task.storyPoints > 0 && (
              <div className="story-points-badge" title="Story Points">
                {task.storyPoints} SP
              </div>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
};
