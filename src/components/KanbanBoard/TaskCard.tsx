import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import type { Task, User } from '../../types';
import { Clock, CheckSquare, MessageSquare, Paperclip } from 'lucide-react';
import './KanbanBoard.css';

interface TaskCardProps {
  task: Task;
  index: number;
  users: User[];
  onCardClick: (taskId: string) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, index, users, onCardClick }) => {
  const assignee = users.find(u => u.id === task.assigneeId);

  const completedSubtasks = task.subtasks.filter(s => s.completed).length;
  const totalSubtasks = task.subtasks.length;

  const priorityLabels: Record<string, string> = {
    low: 'Низкий',
    medium: 'Средний',
    high: 'Высокий',
    urgent: 'Срочно!'
  };

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
          }}
        >
          {/* Top Row: Task ID & Priority */}
          <div className="card-header">
            <span className="task-id">{task.id}</span>
            <span className={`priority-badge priority-${task.priority}`}>
              {priorityLabels[task.priority]}
            </span>
          </div>

          {/* Title */}
          <h4 className="task-title">{task.title}</h4>

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className="task-tags">
              {task.tags.map((tag, idx) => (
                <span key={idx} className="tag-pill">#{tag}</span>
              ))}
            </div>
          )}

          {/* Mini Subtask Progress Bar */}
          {totalSubtasks > 0 && (
            <div className="card-mini-progress">
              <div 
                className="card-mini-progress-fill" 
                style={{ width: `${Math.round((completedSubtasks / totalSubtasks) * 100)}%` }} 
              />
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
                <span title={`Автор задачи: ${task.creatorName}`}>👤 От: {task.creatorName}</span>
              )}
              {task.dueDate && (
                <span style={{ color: '#f59e0b', fontWeight: 600 }} title="Срок выполнения">
                  ⏰ {task.dueDate}
                </span>
              )}
            </div>
          )}

          {/* Bottom Row: Assignee Avatar & Story Points */}
          <div className="card-footer">
            <div className="assignee-info">
              {assignee ? (
                <div className="avatar-small-wrapper" title={`Исполнитель: ${assignee.name} (${assignee.role})`}>
                  <img src={assignee.avatar} alt={assignee.name} className="user-avatar-img" />
                </div>
              ) : (
                <span className="unassigned-badge">Не назначен</span>
              )}
            </div>

            <div className="story-points-badge" title="Story Points (Сложность)">
              <span className="sp-number">{task.storyPoints}</span>
              <span className="sp-label">SP</span>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
};
