import React, { useState } from 'react';
import { Send, X, ExternalLink, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './TelegramWidget.css';

export const TelegramWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { currentUser } = useAuth();

  // Имя бота по умолчанию или настраиваемое
  const botUsername = 'pulse12_team_bot'; // или ваш бот
  const botUrl = `https://t.me/${botUsername}`;

  return (
    <div className="tg-widget-container">
      {isOpen && (
        <div className="tg-widget-card glass-panel animate-fade-in">
          <div className="tg-widget-header">
            <div className="tg-widget-title">
              <Send size={18} className="tg-icon-header" />
              <span>Уведомления в Telegram</span>
            </div>
            <button className="icon-btn" onClick={() => setIsOpen(false)} title="Закрыть">
              <X size={16} />
            </button>
          </div>

          <div className="tg-widget-body">
            <p className="tg-desc">
              Получайте новые задачи, дедлайны и комментарии моментально в <strong>личные сообщения Telegram</strong> (100% конфиденциально).
            </p>

            <div className="tg-step-box">
              <div className="tg-step">
                <span className="tg-step-num">1</span>
                <span>Нажмите кнопку ниже, чтобы открыть нашего бота в Telegram.</span>
              </div>
              <div className="tg-step">
                <span className="tg-step-num">2</span>
                <span>Нажмите <strong>«Запустить» (/start)</strong> и отправьте боту ваш Email:</span>
              </div>
              <div className="tg-user-email">
                <code>{currentUser?.email || 'ваша_почта@company.kz'}</code>
              </div>
            </div>

            <a
              href={botUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="tg-open-btn"
            >
              <Send size={16} />
              <span>Открыть Telegram-бота</span>
              <ExternalLink size={14} style={{ marginLeft: 'auto' }} />
            </a>

            {currentUser?.telegramChatId && (
              <div className="tg-status-connected">
                <ShieldCheck size={16} />
                <span>Ваш Telegram успешно привязан!</span>
              </div>
            )}
          </div>
        </div>
      )}

      <button
        className="tg-floating-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Подключить уведомления в Telegram"
      >
        <span className="tg-pulse-ring" />
        <Send size={18} />
        <span className="tg-btn-text">Telegram бот</span>
      </button>
    </div>
  );
};
