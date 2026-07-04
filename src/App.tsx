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
  const { isLoggedIn, isAdmin, currentUser } = useAuth();
  
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [modalStatus, setModalStatus] = useState<Status>('todo');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setFilters(prev => ({
        ...prev,
        myTasksOnly: !isAdmin
      }));
    }
  }, [currentUser, isAdmin, setFilters]);

  const handleOpenNewModal = (defaultSt: Status = 'todo') => {
    setModalStatus(defaultSt);
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
              <Backlog onOpenNewTaskModal={() => handleOpenNewModal('todo')} />
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

      {/* Task Modal for creating or editing */}
      <TaskModal
        taskId={activeTaskModalId}
        isOpenNew={isNewModalOpen}
        defaultStatus={modalStatus}
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
