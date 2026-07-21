import React from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { BarChart3, TrendingUp, Clock, AlertCircle, Award } from 'lucide-react';
import './Analytics.css';

export const Analytics: React.FC = () => {
  const { tasks, users, groups, activeSprintId } = useTaskContext();
  const employeeUsers = users.filter(u => u.id !== 'usr-1' && u.login?.toLowerCase() !== 'admin');

  const currentTasks = activeSprintId === 'all' 
    ? tasks 
    : tasks.filter(t => t.sprintId === activeSprintId);

  const totalTasks = currentTasks.length || 1;
  const doneTasks = currentTasks.filter(t => t.status === 'done');
  const inProgressTasks = currentTasks.filter(t => t.status === 'in-progress');
  const reviewTasks = currentTasks.filter(t => t.status === 'review');
  const todoTasks = currentTasks.filter(t => t.status === 'todo');

  const completionRate = Math.round((doneTasks.length / totalTasks) * 100);

  const totalSP = currentTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
  const doneSP = doneTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);

  const totalEstimatedHours = currentTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
  const totalLoggedHours = currentTasks.reduce((sum, t) => sum + (t.loggedHours || 0), 0);

  // Priority distribution
  const urgentCount = currentTasks.filter(t => t.priority === 'urgent').length;
  const highCount = currentTasks.filter(t => t.priority === 'high').length;
  const mediumCount = currentTasks.filter(t => t.priority === 'medium').length;
  const lowCount = currentTasks.filter(t => t.priority === 'low').length;

  return (
    <div className="analytics-container animate-fade-in">
      <div className="analytics-header">
        <div>
          <h2 className="analytics-title">Аналитика и Дашборд Эффективности</h2>
          <p className="analytics-subtitle">
            Метрики производительности, распределение Story Points и анализ загрузки {employeeUsers.length} сотрудников компании.
          </p>
        </div>
      </div>

      {/* Top Cards */}
      <div className="metrics-grid">
        <div className="metric-card glass-panel">
          <div className="metric-icon-wrap bg-blue-glow">
            <TrendingUp className="text-blue" size={24} />
          </div>
          <div className="metric-content">
            <span className="metric-label">Прогресс выполнения</span>
            <span className="metric-value">{completionRate}%</span>
            <span className="metric-desc">{doneTasks.length} из {currentTasks.length} задач готово</span>
          </div>
        </div>

        <div className="metric-card glass-panel">
          <div className="metric-icon-wrap bg-purple-glow">
            <BarChart3 className="text-purple" size={24} />
          </div>
          <div className="metric-content">
            <span className="metric-label">Story Points (SP)</span>
            <span className="metric-value">{doneSP} / {totalSP}</span>
            <span className="metric-desc">Завершено единиц сложности</span>
          </div>
        </div>

        <div className="metric-card glass-panel">
          <div className="metric-icon-wrap bg-green-glow">
            <Clock className="text-green" size={24} />
          </div>
          <div className="metric-content">
            <span className="metric-label">Учет времени</span>
            <span className="metric-value">{Number(totalLoggedHours.toFixed(1))}ч</span>
            <span className="metric-desc">Оценка: {Number(totalEstimatedHours.toFixed(1))}ч ({Math.round((totalLoggedHours / (totalEstimatedHours || 1)) * 100)}%)</span>
          </div>
        </div>

        <div className="metric-card glass-panel">
          <div className="metric-icon-wrap bg-amber-glow">
            <AlertCircle className="text-amber" size={24} />
          </div>
          <div className="metric-content">
            <span className="metric-label">Срочные и Важные</span>
            <span className="metric-value">{urgentCount + highCount}</span>
            <span className="metric-desc">🔥 {urgentCount} Urgent • ⚡ {highCount} High</span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Status Breakdown */}
        <div className="chart-panel glass-panel">
          <h3 className="chart-title">Распределение по статусам</h3>
          
          <div className="status-bars">
            <div className="bar-item">
              <div className="bar-label-row">
                <span>Готово (Done)</span>
                <span>{doneTasks.length} ({Math.round((doneTasks.length / totalTasks) * 100)}%)</span>
              </div>
              <div className="bar-track">
                <div className="bar-fill bg-green" style={{ width: `${(doneTasks.length / totalTasks) * 100}%` }} />
              </div>
            </div>

            <div className="bar-item">
              <div className="bar-label-row">
                <span>В работе (In Progress)</span>
                <span>{inProgressTasks.length} ({Math.round((inProgressTasks.length / totalTasks) * 100)}%)</span>
              </div>
              <div className="bar-track">
                <div className="bar-fill bg-blue" style={{ width: `${(inProgressTasks.length / totalTasks) * 100}%` }} />
              </div>
            </div>

            <div className="bar-item">
              <div className="bar-label-row">
                <span>На проверке (Review)</span>
                <span>{reviewTasks.length} ({Math.round((reviewTasks.length / totalTasks) * 100)}%)</span>
              </div>
              <div className="bar-track">
                <div className="bar-fill bg-purple" style={{ width: `${(reviewTasks.length / totalTasks) * 100}%` }} />
              </div>
            </div>

            <div className="bar-item">
              <div className="bar-label-row">
                <span>К выполнению (To Do)</span>
                <span>{todoTasks.length} ({Math.round((todoTasks.length / totalTasks) * 100)}%)</span>
              </div>
              <div className="bar-track">
                <div className="bar-fill bg-slate" style={{ width: `${(todoTasks.length / totalTasks) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Priority Breakdown */}
        <div className="chart-panel glass-panel">
          <h3 className="chart-title">Приоритеты задач</h3>
          
          <div className="priority-bars">
            <div className="bar-item">
              <div className="bar-label-row">
                <span className="text-red font-bold">🔥 Срочно! (Urgent)</span>
                <span>{urgentCount}</span>
              </div>
              <div className="bar-track">
                <div className="bar-fill bg-red" style={{ width: `${(urgentCount / totalTasks) * 100}%` }} />
              </div>
            </div>

            <div className="bar-item">
              <div className="bar-label-row">
                <span className="text-orange font-bold">Высокий (High)</span>
                <span>{highCount}</span>
              </div>
              <div className="bar-track">
                <div className="bar-fill bg-orange" style={{ width: `${(highCount / totalTasks) * 100}%` }} />
              </div>
            </div>

            <div className="bar-item">
              <div className="bar-label-row">
                <span className="text-yellow font-bold">Средний (Medium)</span>
                <span>{mediumCount}</span>
              </div>
              <div className="bar-track">
                <div className="bar-fill bg-yellow" style={{ width: `${(mediumCount / totalTasks) * 100}%` }} />
              </div>
            </div>

            <div className="bar-item">
              <div className="bar-label-row">
                <span className="text-slate font-bold">Низкий (Low)</span>
                <span>{lowCount}</span>
              </div>
              <div className="bar-track">
                <div className="bar-fill bg-slate" style={{ width: `${(lowCount / totalTasks) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Team Leaderboard */}
      <div className="leaderboard-panel glass-panel">
        <div className="leaderboard-header">
          <Award className="text-amber" size={20} />
          <h3 className="chart-title">Вклад сотрудников ({employeeUsers.length} чел.)</h3>
        </div>

        <div className="leaderboard-grid">
          {employeeUsers.map(u => {
            const uTasks = currentTasks.filter(t => t.assigneeId === u.id || (t.assigneeGroupId && groups.some(g => g.id === t.assigneeGroupId && g.memberIds?.includes(u.id))));
            const uDone = uTasks.filter(t => t.status === 'done').length;
            const uSP = uTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
            return (
              <div key={u.id} className="leaderboard-item">
                <img src={u.avatar} alt={u.name} className="leaderboard-avatar" />
                <div className="leaderboard-info">
                  <span className="leader-name">{u.name}</span>
                  <span className="leader-role">{u.role}</span>
                </div>
                <div className="leaderboard-stats">
                  <span className="leader-sp">{uSP} SP</span>
                  <span className="leader-tasks">{uDone}/{uTasks.length} задач</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Group Leaderboard */}
      {groups && groups.length > 0 && (
        <div className="leaderboard-panel glass-panel" style={{ marginTop: '24px' }}>
          <div className="leaderboard-header">
            <span style={{ fontSize: '1.2rem' }}>🏢</span>
            <h3 className="chart-title">Эффективность Команд / Отделов ({groups.length})</h3>
          </div>

          <div className="leaderboard-grid">
            {groups.map(grp => {
              const grpTasks = currentTasks.filter(t => t.assigneeGroupId === grp.id || (t.assigneeId && grp.memberIds?.includes(t.assigneeId)));
              const grpDone = grpTasks.filter(t => t.status === 'done').length;
              const grpSP = grpTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
              return (
                <div key={grp.id} className="leaderboard-item" style={{ borderLeft: `4px solid ${grp.color || '#3b82f6'}` }}>
                  <div className="leaderboard-info">
                    <span className="leader-name">{grp.name}</span>
                    <span className="leader-role">{grp.memberIds?.length || 0} участников в команде</span>
                  </div>
                  <div className="leaderboard-stats">
                    <span className="leader-sp">{grpSP} SP</span>
                    <span className="leader-tasks">{grpDone}/{grpTasks.length} задач</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
