import React, { useState, useEffect } from 'react';
import { TaskProvider, useTaskContext } from './context/TaskContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header/Header';
import { KanbanBoard } from './components/KanbanBoard/KanbanBoard';
import { Backlog } from './components/Backlog/Backlog';
import { TeamWorkload } from './components/TeamWorkload/TeamWorkload';
import { Analytics } from './components/Analytics/Analytics';
import { Profile } from './components/Profile/Profile';
import { AdminPanel } from './components/AdminPanel/AdminPanel';
import { WelcomePage } from './components/Welcome/WelcomePage';
import { LoginModal } from './components/Login/LoginModal';
import { TaskModal } from './components/TaskModal/TaskModal';
import { NetworkModal } from './components/NetworkModal/NetworkModal';
import { UserManualModal } from './components/Help/UserManualModal';
import type { Status } from './types';
import './App.css';

const AppContent: React.FC = () => {
  const { viewMode, activeTaskModalId, setActiveTaskModalId, setFilters } = useTaskContext();
  const { isLoggedIn, isAdmin, currentUser, sessionExpired, clearSessionExpired } = useAuth();
  
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [modalStatus, setModalStatus] = useState<Status>('todo');
  const [modalSprintId, setModalSprintId] = useState<string | null | undefined>(undefined);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setFilters(prev => ({
        ...prev,
        myTasksOnly: !isAdmin
      }));
    }
  }, [currentUser, isAdmin, setFilters]);

  const handleOpenNewModal = (defaultSt: Status = 'todo', sprintId?: string | null) => {
    setModalStatus(defaultSt);
    setModalSprintId(sprintId);
    setIsNewModalOpen(true);
    setActiveTaskModalId(null);
  };

  const handleCloseModal = () => {
    setIsNewModalOpen(false);
    setActiveTaskModalId(null);
  };

  return (
    <div className="app-main-wrapper">
      <Header 
        onOpenNewTaskModal={() => handleOpenNewModal('todo')} 
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
      />

      <main className="main-content-area">
        {!isLoggedIn ? (
          <WelcomePage onOpenLogin={() => setIsLoginModalOpen(true)} />
        ) : (
          <>
            {viewMode === 'board' && (
              <KanbanBoard onOpenNewTaskModalWithStatus={(st) => handleOpenNewModal(st)} />
            )}
            {viewMode === 'backlog' && (
              <Backlog onOpenNewTaskModal={(spId) => handleOpenNewModal('todo', spId)} />
            )}
            {viewMode === 'workload' && (
              <TeamWorkload />
            )}
            {viewMode === 'analytics' && (
              <Analytics />
            )}
            {viewMode === 'profile' && (
              <Profile />
            )}
            {viewMode === 'admin' && (
              <AdminPanel />
            )}
          </>
        )}
      </main>

      {/* Session Expired Modal */}
      {sessionExpired && (
        <div className="modal-overlay" style={{ zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
          <div className="modal-card" style={{ maxWidth: '440px', textAlign: 'center', padding: '32px 28px', border: '1px solid #f59e0b', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⏳</div>
            <h3 style={{ fontSize: '1.4rem', color: '#f59e0b', marginBottom: '12px' }}>Сеанс завершен из-за неактивности</h3>
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '24px' }}>
              В целях безопасности вашей корпоративной учетной записи сеанс был автоматически прекращен после 15 минут неактивности. Пожалуйста, войдите в систему повторно.
            </p>
            <button
              className="btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              onClick={() => {
                clearSessionExpired();
                setIsLoginModalOpen(true);
              }}
            >
              🔐 Войти снова
            </button>
          </div>
        </div>
      )}

      {/* Task Modal for creating or editing */}
      <TaskModal
        taskId={activeTaskModalId}
        isOpenNew={isNewModalOpen}
        defaultStatus={modalStatus}
        defaultSprintId={modalSprintId}
        onClose={handleCloseModal}
      />

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />

      {/* Network Configuration & Online Users Modal */}
      <NetworkModal />

      {/* Interactive User Manual Modal */}
      <UserManualModal />
    </div>
  );
};

export function App() {
  return (
    <TaskProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </TaskProvider>
  );
}

export default App;
