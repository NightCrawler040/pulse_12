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
    tasks,
    sprints,
    activeSprintId,
    users, 
    moveTask, 
    setActiveTaskModalId,
    filters,
    setFilters,
    groups
  } = useTaskContext();

  const { currentUser } = useAuth();

  const currentSprint = React.useMemo(() => {
    if (activeSprintId !== 'all') {
      return sprints.find(s => s.id === activeSprintId);
    }
    return sprints.find(s => s.isActive) || sprints[0];
  }, [sprints, activeSprintId]);

  const sprintStats = React.useMemo(() => {
    if (!currentSprint) return null;
    const now = new Date();
    const end = new Date(currentSprint.endDate);
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const sprintTasks = tasks.filter(t => t.sprintId === currentSprint.id);
    const completedTasks = sprintTasks.filter(t => t.status === 'done');
    const totalPoints = sprintTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    const completedPoints = completedTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    const progressPercent = sprintTasks.length > 0 ? Math.round((completedTasks.length / sprintTasks.length) * 100) : 0;

    return { diffDays, sprintTasksCount: sprintTasks.length, completedTasksCount: completedTasks.length, totalPoints, completedPoints, progressPercent };
  }, [currentSprint, tasks]);

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

      {currentSprint && sprintStats && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(147, 51, 234, 0.12) 100%)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '12px',
          padding: '16px 20px',
          margin: '0 0 20px 0',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 300px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1.4rem' }}>🚀</span>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
                {currentSprint.name}
              </h3>
              {currentSprint.isActive && (
                <span style={{ background: '#10b981', color: 'white', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                  Активный спринт
                </span>
              )}
              <span style={{
                background: sprintStats.diffDays > 2 ? 'rgba(59, 130, 246, 0.15)' : sprintStats.diffDays >= 0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: sprintStats.diffDays > 2 ? '#3b82f6' : sprintStats.diffDays >= 0 ? '#f59e0b' : '#ef4444',
                border: `1px solid ${sprintStats.diffDays > 2 ? '#3b82f6' : sprintStats.diffDays >= 0 ? '#f59e0b' : '#ef4444'}`,
                padding: '2px 10px',
                borderRadius: '12px',
                fontSize: '0.8rem',
                fontWeight: 600
              }}>
                ⏳ {sprintStats.diffDays > 0 ? `Осталось дней: ${sprintStats.diffDays}` : sprintStats.diffDays === 0 ? 'Последний день!' : `Завершен (${Math.abs(sprintStats.diffDays)} дн. назад)`}
              </span>
            </div>
            {currentSprint.goal && (
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'hsl(var(--text-secondary))', fontStyle: 'italic' }}>
                🎯 <strong>Цель:</strong> {currentSprint.goal}
              </p>
            )}
          </div>

          {/* Progress Bar & Stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '240px', flex: '0 1 320px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
              <span>Прогресс (Burn-down)</span>
              <span style={{ color: 'hsl(var(--primary))' }}>{sprintStats.progressPercent}%</span>
            </div>
            <div style={{ width: '100%', height: '10px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{
                width: `${sprintStats.progressPercent}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #3b82f6 0%, #10b981 100%)',
                transition: 'width 0.5s ease'
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
              <span>Задачи: <strong>{sprintStats.completedTasksCount} / {sprintStats.sprintTasksCount}</strong></span>
              <span>Story Points: <strong>{sprintStats.completedPoints} / {sprintStats.totalPoints} SP</strong></span>
            </div>
          </div>
        </div>
      )}

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
