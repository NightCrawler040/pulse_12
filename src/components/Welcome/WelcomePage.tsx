import React from 'react';
import { ShieldCheck, Users, Zap, Server, LogIn } from 'lucide-react';
import { useTaskContext } from '../../context/TaskContext';
import './WelcomePage.css';

interface WelcomePageProps {
  onOpenLogin: () => void;
}

export const WelcomePage: React.FC<WelcomePageProps> = ({ onOpenLogin }) => {
  const { isServerConnected, users, onlineUserIds } = useTaskContext();
  const employeeCount = users.filter(u => u.roleType !== 'admin').length;

  return (
    <div className="welcome-container animate-fade-in">
      <div className="welcome-hero">
        <div className="welcome-badge">🏢 Корпоративная платформа Pulse 12</div>

        <h1 className="welcome-title">
          Управление задачами и командами <br />в изолированной LAN-сети
        </h1>

        <p className="welcome-subtitle">
          Безопасное пространство для совместной работы 12 сотрудников корпорации. Полная автономность, мгновенная синхронизация по WebSocket и контроль доступа.
        </p>

        <div className="welcome-actions">
          <button className="btn-primary welcome-btn" onClick={onOpenLogin}>
            <LogIn size={20} />
            <span>Войти в систему</span>
          </button>
        </div>

        <div className="welcome-server-status">
          <div className="server-status-pill">
            <Server size={16} style={{ color: isServerConnected ? '#22c55e' : '#ef4444' }} />
            <span>Статус сервера:</span>
            <strong style={{ color: isServerConnected ? '#22c55e' : '#ef4444' }}>
              {isServerConnected ? `🟢 Подключено (Онлайн: ${onlineUserIds.length || 1} из ${employeeCount})` : '⚠️ Локальный режим'}
            </strong>
          </div>
        </div>
      </div>

      <div className="welcome-features-grid">
        <div className="welcome-feature-card">
          <div className="feature-icon-wrapper blue">
            <Zap size={24} />
          </div>
          <h3>Канбан-доски и Спринты</h3>
          <p>
            Управляйте задачами с помощью интерактивных колонок, подзадач, чек-листов и трекинга затраченного времени.
          </p>
        </div>

        <div className="welcome-feature-card">
          <div className="feature-icon-wrapper purple">
            <Users size={24} />
          </div>
          <h3>Командная работа в LAN</h3>
          <p>
            Мгновенные уведомления, совместное комментирование и индикация присутствия сотрудников онлайн.
          </p>
        </div>

        <div className="welcome-feature-card">
          <div className="feature-icon-wrapper green">
            <ShieldCheck size={24} />
          </div>
          <h3>Ролевая безопасность (RBAC)</h3>
          <p>
            Четкое разделение прав администраторов, руководителей команд и специалистов с защищенными профилями.
          </p>
        </div>
      </div>
    </div>
  );
};
