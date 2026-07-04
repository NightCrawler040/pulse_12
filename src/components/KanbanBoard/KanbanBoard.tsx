import React from 'react';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import { useTaskContext } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { KanbanColumn } from './KanbanColumn';
import type { Status } from '../../types';
import confetti from 'canvas-confetti';
import { Download, Filter } from 'lucide-react';
import './KanbanBoard.css';

interface KanbanBoardProps {
  onOpenNewTaskModalWithStatus: (status: Status) => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ onOpenNewTaskModalWithStatus }) => {
  const { 
    columns, 
    filteredTasks, 
    users, 
    moveTask, 
    setActiveTaskModalId,
    filters,
    setFilters,
    groups
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

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    // Dropped outside the list
    if (!destination) return;

    // Dropped in the same place
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const newStatus = destination.droppableId as Status;
    moveTask(draggableId, newStatus);

    // Trigger confetti celebration if task is moved to 'done'
    if (newStatus === 'done' && source.droppableId !== 'done') {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#10B981', '#3B82F6', '#A855F7', '#F59E0B']
      });
    }
  };

  const handleExportExcel = () => {
    const headers = ['ID', 'Название', 'Статус', 'Приоритет', 'Исполнитель', 'Story Points', 'Оценка (ч)', 'Затрачено (ч)', 'Теги'];
    const rows = displayTasks.map(t => {
      const assignee = users.find(u => u.id === t.assigneeId)?.name || 'Не назначен';
      return [
        t.id,
        `"${t.title.replace(/"/g, '""')}"`,
        t.status,
        t.priority,
        `"${assignee}"`,
        t.storyPoints,
        t.estimatedHours,
        t.loggedHours,
        `"${(t.tags || []).join(', ')}"`
      ].join(';');
    });
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `pulse12_tasks_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="kanban-board-container">
      {/* Board Top Toolbar: Excel Export & Priority Filter */}
      <div className="board-top-toolbar">
        <div className="board-toolbar-left">
          <Filter size={16} style={{ color: 'hsl(var(--primary))' }} />
          <span className="toolbar-label">Приоритет:</span>
          <select
            value={filters.priority}
            onChange={e => setFilters(prev => ({ ...prev, priority: e.target.value as any }))}
            className="toolbar-select"
          >
            <option value="all">⭐ Все приоритеты</option>
            <option value="urgent">🔥 Срочно!</option>
            <option value="high">🔴 Высокий</option>
            <option value="medium">🟡 Средний</option>
            <option value="low">🔵 Низкий</option>
          </select>

          <button
            className="btn-secondary"
            onClick={() => setFilters(prev => ({ ...prev, myTasksOnly: !prev.myTasksOnly }))}
            title="Фильтр: показывать только ваши задачи и задачи, где вы участвуете"
            style={{
              background: filters.myTasksOnly ? 'hsl(var(--primary))' : 'rgba(255,255,255,0.05)',
              color: filters.myTasksOnly ? '#fff' : 'inherit',
              borderColor: filters.myTasksOnly ? 'hsl(var(--primary))' : 'rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            <span>{filters.myTasksOnly ? '👤 Мои задачи и участие' : '👥 Все задачи'}</span>
          </button>
        </div>

        <div className="board-toolbar-right">
          <button
            className="btn-secondary export-excel-btn"
            onClick={handleExportExcel}
            title="Выгрузить текущий спринт / задачи в CSV (с поддержкой кодировки UTF-8 BOM для Microsoft Excel)"
          >
            <Download size={16} />
            <span>📥 Выгрузить в Excel / CSV</span>
          </button>
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="kanban-grid">
          {columns.map((col) => {
            const columnTasks = displayTasks.filter(t => t.status === col.id);
            return (
              <KanbanColumn
                key={col.id}
                column={col}
                tasks={columnTasks}
                users={users}
                onCardClick={(taskId) => setActiveTaskModalId(taskId)}
                onAddTaskToColumn={(status) => onOpenNewTaskModalWithStatus(status)}
              />
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
};
