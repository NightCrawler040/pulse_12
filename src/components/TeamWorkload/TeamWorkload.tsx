import React from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { Mail, Briefcase, Clock, AlertTriangle, ShieldCheck, Moon } from 'lucide-react';
import './TeamWorkload.css';

export const TeamWorkload: React.FC = () => {
  const { users, groups, tasks, setFilters, setViewMode } = useTaskContext();
  const employees = users.filter(u => u.roleType !== 'admin');

  const handleSelectUser = (userId: string) => {
    setFilters(prev => ({ ...prev, assigneeId: userId }));
    setViewMode('board');
  };

  return (
    <div className="workload-container animate-fade-in">
      <div className="workload-header">
        <div>
          <h2 className="workload-title">Команда корпорации ({employees.length} сотрудников)</h2>
          <p className="workload-subtitle">
            Отслеживайте распределение задач и загруженность специалистов в реальном времени. Нажмите на карточку, чтобы перейти к задачам сотрудника.
          </p>
        </div>
      </div>

      {groups && groups.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'hsl(var(--text-main))', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🏢 Сформированные команды ({groups.length})</span>
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
            {groups.map(grp => {
              const members = employees.filter(e => grp.memberIds.includes(e.id));
              return (
                <div key={grp.id} style={{ background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border-color))', borderRadius: '12px', padding: '14px', borderLeft: `4px solid ${grp.color || '#3b82f6'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'hsl(var(--text-main))' }}>{grp.name}</span>
                    <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(59,132,246,0.1)', color: grp.color || '#3b82f6', fontWeight: 600 }}>
                      {members.length} чел.
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                    {members.map(m => (
                      <span key={m.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', background: 'hsl(var(--bg-secondary))', padding: '3px 8px', borderRadius: '6px' }}>
                        {m.name}
                      </span>
                    ))}
                    {members.length === 0 && (
                      <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Участники не добавлены</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="workload-grid">
        {employees.map(user => {
          const userTasks = tasks.filter(t => t.assigneeId === user.id || (t.assigneeGroupId && groups?.some(g => g.id === t.assigneeGroupId && g.memberIds?.includes(user.id))));
          const inProgressTasks = userTasks.filter(t => t.status === 'in-progress');
          const reviewTasks = userTasks.filter(t => t.status === 'review');
          const doneTasks = userTasks.filter(t => t.status === 'done');
          
          const totalSP = userTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
          const activeSP = inProgressTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
          const loggedHours = Number(userTasks.reduce((sum, t) => sum + (t.loggedHours || 0), 0).toFixed(1));
          const estHours = Number(userTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0).toFixed(1));

          let statusBadge = { label: 'Оптимально', class: 'status-optimal', icon: <ShieldCheck size={14} /> };
          if (activeSP > 8 || inProgressTasks.length >= 3) {
            statusBadge = { label: '🔥 Перегружен', class: 'status-overload', icon: <AlertTriangle size={14} /> };
          } else if (userTasks.length === 0 || (inProgressTasks.length === 0 && reviewTasks.length === 0)) {
            statusBadge = { label: '💤 Свободен', class: 'status-idle', icon: <Moon size={14} /> };
          }

          return (
            <div 
              key={user.id} 
              className="employee-card glass-panel"
              onClick={() => handleSelectUser(user.id)}
            >
              {/* Card top */}
              <div className="emp-top">
                <img src={user.avatar} alt={user.name} className="emp-avatar" />
                <div className="emp-info">
                  <h3 className="emp-name">{user.name}</h3>
                  <span className="emp-role">
                    <Briefcase size={13} /> {user.role}
                  </span>
                  <span className="emp-dept">{user.department}</span>
                </div>
              </div>

              {/* Status Badge */}
              <div className={`emp-workload-badge ${statusBadge.class}`}>
                {statusBadge.icon}
                <span>{statusBadge.label}</span>
              </div>

              {/* Stats Grid */}
              <div className="emp-stats-grid">
                <div className="emp-stat">
                  <span className="stat-value">{userTasks.length}</span>
                  <span className="stat-name">Всего задач</span>
                </div>
                <div className="emp-stat">
                  <span className="stat-value text-blue">{inProgressTasks.length}</span>
                  <span className="stat-name">В работе</span>
                </div>
                <div className="emp-stat">
                  <span className="stat-value text-purple">{reviewTasks.length}</span>
                  <span className="stat-name">На проверке</span>
                </div>
                <div className="emp-stat">
                  <span className="stat-value text-green">{doneTasks.length}</span>
                  <span className="stat-name">Готово</span>
                </div>
              </div>

              {/* SP and Hours */}
              <div className="emp-footer">
                <div className="sp-info">
                  <span className="sp-val">{totalSP} SP</span>
                  <span className="sp-desc">Сложность</span>
                </div>
                <div className="hours-info">
                  <Clock size={13} />
                  <span>{loggedHours}ч / {estHours}ч</span>
                </div>
              </div>

              {/* Email link */}
              <div className="emp-email">
                <Mail size={12} />
                <span>{user.email}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
