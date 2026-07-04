import React from 'react';
import { Sparkles, ShieldCheck, Users, Zap, ArrowRight, Server } from 'lucide-react';
import { useTaskContext } from '../../context/TaskContext';
import './WelcomePage.css';

interface WelcomePageProps {
  onOpenLogin: () => void;
}

export const WelcomePage: React.FC<WelcomePageProps> = ({ onOpenLogin }) => {
  const { isServerConnected, users, onlineUserIds } = useTaskContext();

  return (
    <div className="welcome-container animate-fade-in">
      <div className="welcome-hero">
        <div className="welcome-badge">
          <Sparkles size={16} className="badge-icon" />
          <span>Корпоративная сеть Pulse12 vSphere LAN</span>
        </div>

        <h1 className="welcome-title">
          Интеллектуальное управление <br />
          <span className="gradient-text">проектами и задачами</span>
        </h1>

        <p className="welcome-subtitle">
          Единое рабочее пространство для agile-команд. Синхронизация задач в реальном времени, 
          ролевой доступ (RBAC) и прозрачный контроль спринтов без выхода в глобальный интернет.
        </p>

        <div className="welcome-cta-group">
          <button className="btn-welcome-primary" onClick={onOpenLogin}>
            <span>🔑 Войти в систему / Выбрать сотрудника</span>
            <ArrowRight size={20} />
          </button>
        </div>

        <div className="welcome-server-status">
          <div className="server-status-pill">
            <Server size={16} style={{ color: isServerConnected ? '#22c55e' : '#ef4444' }} />
            <span>Статус сервера:</span>
            <strong style={{ color: isServerConnected ? '#22c55e' : '#ef4444' }}>
              {isServerConnected ? `🟢 Подключено (Онлайн: ${onlineUserIds.length || 1} из ${users.length})` : '⚠️ Локальный режим'}
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
