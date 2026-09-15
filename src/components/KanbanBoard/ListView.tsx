import React, { useState } from 'react';
import type { Task, Column, User } from '../../types';
import './ListView.css';

interface ListViewProps {
  tasks: Task[];
  columns: Column[];
  users: User[];
  onCardClick: (taskId: string) => void;
}

export const ListView: React.FC<ListViewProps> = ({ tasks, columns, users, onCardClick }) => {
  const [collapsedStatuses, setCollapsedStatuses] = useState<Record<string, boolean>>({});

  const toggleStatus = (statusId: string) => {
    setCollapsedStatuses(prev => ({ ...prev, [statusId]: !prev[statusId] }));
  };

  return (
    <div className="list-view-container">
      {columns.map(col => {
        const columnTasks = tasks.filter(t => t.status === col.id);
        if (columnTasks.length === 0) return null;

        const isCollapsed = collapsedStatuses[col.id];

        return (
          <div key={col.id} className="list-view-group">
            <div 
              className="list-view-group-header" 
              onClick={() => toggleStatus(col.id)}
              style={{ borderLeftColor: col.color }}
            >
              <div className="group-header-left">
                <span className={`collapse-icon ${isCollapsed ? 'collapsed' : ''}`}>▼</span>
                <span className="group-title">{col.title}</span>
                <span className="group-count">{columnTasks.length}</span>
              </div>
            </div>

            {!isCollapsed && (
              <div className="list-view-table-wrapper">
                <table className="list-view-table">
                  <thead>
                    <tr>
                      <th style={{ width: '100px' }}>Ключ</th>
                      <th>Название</th>
                      <th style={{ width: '140px' }}>Приоритет</th>
                      <th style={{ width: '220px' }}>Исполнитель</th>
                      <th style={{ width: '80px' }}>SP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {columnTasks.map(task => {
                      const assignee = users.find(u => u.id === task.assigneeId);
                      return (
                        <tr key={task.id} className="list-view-row" onClick={() => onCardClick(task.id)}>
                          <td className="task-id-cell">{task.id}</td>
                          <td className="task-title-cell">{task.title}</td>
                          <td className="task-priority-cell">
                            <span className={`priority-badge ${task.priority}`}>
                              {task.priority}
                            </span>
                          </td>
                          <td className="task-assignee-cell">
                            {assignee ? (
                              <div className="assignee-info">
                                {assignee.avatar && !assignee.avatar.startsWith('http') ? (
                                  <div className="assignee-avatar-fallback">{assignee.name.charAt(0)}</div>
                                ) : assignee.avatar ? (
                                  <img src={assignee.avatar} alt="avatar" className="assignee-avatar" />
                                ) : (
                                  <div className="assignee-avatar-fallback">{assignee.name.charAt(0)}</div>
                                )}
                                <span>{assignee.name}</span>
                              </div>
                            ) : (
                              <span className="unassigned">Не назначен</span>
                            )}
                          </td>
                          <td className="task-sp-cell">{task.storyPoints || 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
