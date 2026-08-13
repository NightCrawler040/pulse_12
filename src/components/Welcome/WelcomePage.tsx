import React, { useState, useEffect } from 'react';
import { LogIn, Terminal, Activity, Lock, Cpu, Server } from 'lucide-react';
import { useTaskContext } from '../../context/TaskContext';
import spiderLogo from '../../assets/spider-logo-clean.png';
import './WelcomePage.css';

interface WelcomePageProps {
  onOpenLogin: () => void;
}

export const WelcomePage: React.FC<WelcomePageProps> = ({ onOpenLogin }) => {
  const { isServerConnected, users, onlineUserIds } = useTaskContext();
  const employeeCount = users.filter(u => u.id !== 'usr-1' && u.login?.toLowerCase() !== 'admin').length;
  const onlineCount = onlineUserIds.length || 1;

  // Fake boot sequence effect for the terminal
  const [bootText, setBootText] = useState<string[]>([]);
  
  useEffect(() => {
    const lines = [
      '> INITIALIZING PULSE-12 KERNEL...',
      '> SECURE CONNECTION ESTABLISHED',
      '> LOADING ENCRYPTED MODULES...',
      '> RBAC PROTOCOLS ACTIVE',
      '> SYSTEM READY.'
    ];
    let currentIndex = 0;
    
    const interval = setInterval(() => {
      if (currentIndex < lines.length) {
        setBootText(prev => [...prev, lines[currentIndex]]);
        currentIndex++;
      } else {
        clearInterval(interval);
      }
    }, 400);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="welcome-container cyber-theme">
      {/* Floating Small Spiders */}
      <div className="spider-particles">
        {Array.from({ length: 8 }).map((_, i) => (
          <img 
            key={i}
            src={spiderLogo} 
            alt="" 
            className={`cyber-spider-bg particle-${i + 1}`} 
          />
        ))}
      </div>

      <div className="welcome-split-layout">
        
        {/* Left Side: Typography & CTA */}
        <div className="welcome-content-left">
          <div className="cyber-eyebrow">
            <span className="blink-dot"></span> SECURE WORKSPACE // INTERNAL ONLY
          </div>
          <h1 className="welcome-title cyber-title">
            КООРДИНАЦИЯ.<br />
            БЕЗОПАСНОСТЬ.<br />
            <span className="accent-text">PULSE 12</span>
          </h1>
          <p className="welcome-subtitle cyber-subtitle">
            Закрытый портал управления проектами и инцидентами. Никакого визуального шума — только чистый функционал и полный контроль над процессами.
          </p>
          
          <button className="btn-cyber-primary" onClick={onOpenLogin}>
            <LogIn size={20} className="btn-icon" />
            <span className="btn-text">ИНИЦИАЛИЗАЦИЯ ВХОДА</span>
          </button>
        </div>

        {/* Right Side: Cyber Panel / Terminal */}
        <div className="welcome-content-right">
          <div className="cyber-panel">
            <div className="panel-header">
              <Terminal size={14} />
              <span>system_status.sh</span>
            </div>
            
            <div className="panel-body">
              <div className="terminal-boot">
                {bootText.map((line, i) => (
                  <div key={i} className="terminal-line">{line}</div>
                ))}
                {bootText.length >= 5 && <div className="terminal-cursor">_</div>}
              </div>

              <div className="status-grid">
                <div className="status-box">
                  <div className="status-icon-wrapper connected">
                    <Server size={18} />
                  </div>
                  <div className="status-info">
                    <span className="status-label">SERVER STATUS</span>
                    <strong className={isServerConnected ? 'text-green' : 'text-red'}>
                      {isServerConnected ? 'ONLINE / CONNECTED' : 'OFFLINE / LOCAL'}
                    </strong>
                  </div>
                </div>

                <div className="status-box">
                  <div className="status-icon-wrapper active">
                    <Activity size={18} />
                  </div>
                  <div className="status-info">
                    <span className="status-label">ACTIVE PERSONNEL</span>
                    <strong className="text-cyan">{onlineCount} / {employeeCount} USERS</strong>
                  </div>
                </div>

                <div className="status-box">
                  <div className="status-icon-wrapper secure">
                    <Lock size={18} />
                  </div>
                  <div className="status-info">
                    <span className="status-label">ENCRYPTION / RBAC</span>
                    <strong className="text-green">ENABLED & ENFORCED</strong>
                  </div>
                </div>

                <div className="status-box">
                  <div className="status-icon-wrapper processing">
                    <Cpu size={18} />
                  </div>
                  <div className="status-info">
                    <span className="status-label">WEBSOCKET SYNC</span>
                    <strong className="text-cyan">REAL-TIME ACTIVE</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
