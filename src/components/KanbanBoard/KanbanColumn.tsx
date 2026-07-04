import React from 'react';
import { Droppable } from '@hello-pangea/dnd';
import type { Column, Task, User } from '../../types';
import { TaskCard } from './TaskCard';
import { Plus } from 'lucide-react';
import './KanbanBoard.css';

interface KanbanColumnProps {
  column: Column;
  tasks: Task[];
  users: User[];
  onCardClick: (taskId: string) => void;
  onAddTaskToColumn: (status: Column['id']) => void;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  column,
  tasks,
  users,
  onCardClick,
  onAddTaskToColumn
}) => {
  const totalStoryPoints = tasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);

  return (
    <div className="kanban-column glass-panel">
      {/* Column Header */}
      <div className="column-header" style={{ borderTopColor: column.color }}>
        <div className="column-title-row">
          <div className="column-dot" style={{ backgroundColor: column.color }} />
          <h3 className="column-title">{column.title}</h3>
          <span className="column-count">{tasks.length}</span>
        </div>

        <div className="column-metrics">
          <span className="col-sp" title="Сумма Story Points в колонке">
            {totalStoryPoints} SP
          </span>
          <button 
            className="add-task-col-btn"
            onClick={() => onAddTaskToColumn(column.id)}
            title="Добавить задачу в эту колонку"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Droppable Task List */}
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`column-task-list ${snapshot.isDraggingOver ? 'drag-over' : ''}`}
          >
            {tasks.map((task, index) => (
              <TaskCard
                key={task.id}
                task={task}
                index={index}
                users={users}
                onCardClick={onCardClick}
              />
            ))}
            {provided.placeholder}

            {tasks.length === 0 && !snapshot.isDraggingOver && (
              <div className="empty-column-state">
                <span>Перетащите задачи сюда</span>
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
};
