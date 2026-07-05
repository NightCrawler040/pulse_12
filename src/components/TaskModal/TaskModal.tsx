import React, { useState, useRef, useEffect } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/api';
import type { Status, Priority, Attachment } from '../../types';
import { 
  X, 
  Trash2, 
  CheckSquare, 
  Plus, 
  Clock, 
  MessageSquare, 
  Tag, 
  User as UserIcon, 
  AlertCircle, 
  Send,
  Paperclip,
  Download,
  Play,
  Square,
  Upload,
  FileText
} from 'lucide-react';
import './TaskModal.css';

interface TaskModalProps {
  taskId: string | null;
  isOpenNew: boolean;
  defaultStatus?: Status;
  onClose: () => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({ taskId, isOpenNew, defaultStatus = 'todo', onClose }) => {
  const { 
    tasks, 
    users, 
    groups, 
    columns, 
    sprints, 
    addTask, 
    updateTask, 
    deleteTask, 
    addComment
  } = useTaskContext();

  const { canEditTask, canDeleteTask } = useAuth();

  const existingTask = taskId ? tasks.find(t => t.id === taskId) : null;
  const isEditable = !existingTask || canEditTask(existingTask);

  // Local state for New Task or Editing
  const [title, setTitle] = useState(existingTask?.title || '');
  const [description, setDescription] = useState(existingTask?.description || '');
  const [status, setStatus] = useState<Status>(existingTask?.status || defaultStatus);
  const [priority, setPriority] = useState<Priority>(existingTask?.priority || 'medium');
  const [assigneeId, setAssigneeId] = useState<string | null>(existingTask?.assigneeId || null);
  const [assigneeGroupId, setAssigneeGroupId] = useState<string | null>(existingTask?.assigneeGroupId || null);
  const [storyPoints, setStoryPoints] = useState<number>(existingTask?.storyPoints || 3);
  const [estimatedHours, setEstimatedHours] = useState<number>(existingTask?.estimatedHours || 8);
  const [loggedHours, setLoggedHours] = useState<number>(existingTask?.loggedHours || 0);
  const [sprintId, setSprintId] = useState<string | null>(existingTask?.sprintId || 'sprint-1');
  const [tags, setTags] = useState<string[]>(existingTask?.tags || ['Engineering']);
  const [newTagInput, setNewTagInput] = useState('');
  
  // New subtasks, attachments & timer state
  const [subtasksList, setSubtasksList] = useState<any[]>(existingTask?.subtasks || []);
  const [attachmentsList, setAttachmentsList] = useState<Attachment[]>(existingTask?.attachments || []);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [commentText, setCommentText] = useState('');
  const [commentUserId, setCommentUserId] = useState<string>(users[0]?.id || 'usr-1');

  useEffect(() => {
    if (isOpenNew) {
      setTitle('');
      setDescription('');
      setStatus(defaultStatus);
      setPriority('medium');
      setAssigneeId(null);
      setAssigneeGroupId(null);
      setStoryPoints(3);
      setEstimatedHours(8);
      setLoggedHours(0);
      setSprintId('sprint-1');
      setTags(['Engineering']);
      setSubtasksList([]);
      setAttachmentsList([]);
    } else if (existingTask) {
      setTitle(existingTask.title || '');
      setDescription(existingTask.description || '');
      setStatus(existingTask.status || defaultStatus);
      setPriority(existingTask.priority || 'medium');
      setAssigneeId(existingTask.assigneeId || null);
      setAssigneeGroupId(existingTask.assigneeGroupId || null);
      setStoryPoints(existingTask.storyPoints || 0);
      setEstimatedHours(existingTask.estimatedHours || 0);
      setLoggedHours(existingTask.loggedHours || 0);
      setSprintId(existingTask.sprintId || 'sprint-1');
      setTags(existingTask.tags || []);
      setSubtasksList(existingTask.subtasks || []);
      setAttachmentsList(existingTask.attachments || []);
    }
  }, [taskId, isOpenNew, defaultStatus]);

  useEffect(() => {
    if (existingTask?.attachments) {
      setAttachmentsList(existingTask.attachments);
    }
    if (existingTask?.subtasks) {
      setSubtasksList(existingTask.subtasks);
    }
  }, [existingTask?.attachments, existingTask?.subtasks]);

  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  if (!isOpenNew && !existingTask) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditable) {
      alert('У вас нет прав на редактирование этой задачи. Обратитесь к Администратору или Руководителю.');
      return;
    }
    if (!title.trim()) {
      alert('Пожалуйста, введите название задачи');
      return;
    }

    if (isOpenNew) {
      addTask({
        title,
        description,
        status,
        priority,
        assigneeId,
        assigneeGroupId,
        storyPoints: Number(storyPoints) || 0,
        estimatedHours: Number(estimatedHours) || 0,
        loggedHours: Number(loggedHours) || 0,
        sprintId,
        tags,
        subtasks: subtasksList,
        attachments: attachmentsList
      });
    } else if (existingTask) {
      updateTask(existingTask.id, {
        title,
        description,
        status,
        priority,
        assigneeId,
        assigneeGroupId,
        storyPoints: Number(storyPoints) || 0,
        estimatedHours: Number(estimatedHours) || 0,
        loggedHours: Number(loggedHours) || 0,
        sprintId,
        tags,
        subtasks: subtasksList,
        attachments: attachmentsList
      });
    }
    onClose();
  };

  const handleDelete = () => {
    if (!canDeleteTask()) {
      alert('Удаление задач разрешено только Администраторам.');
      return;
    }
    if (existingTask && window.confirm(`Удалить задачу ${existingTask.id}? Это действие необратимо.`)) {
      deleteTask(existingTask.id);
      onClose();
    }
  };

  const handleAddTag = () => {
    if (!isEditable) return;
    if (newTagInput.trim() && !tags.includes(newTagInput.trim())) {
      setTags([...tags, newTagInput.trim()]);
      setNewTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!isEditable) return;
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleAddSubtask = () => {
    if (!isEditable) return;
    if (!newSubtaskTitle.trim()) return;
    const newSubtask = {
      id: `sub-${Date.now()}`,
      title: newSubtaskTitle.trim(),
      completed: false
    };
    const nextSubtasks = [...subtasksList, newSubtask];
    setSubtasksList(nextSubtasks);
    if (existingTask) {
      updateTask(existingTask.id, { subtasks: nextSubtasks });
    }
    setNewSubtaskTitle('');
  };

  const handleToggleSubtask = (subId: string) => {
    if (!isEditable) return;
    const nextSubtasks = subtasksList.map(s => s.id === subId ? { ...s, completed: !s.completed } : s);
    setSubtasksList(nextSubtasks);
    if (existingTask) {
      updateTask(existingTask.id, { subtasks: nextSubtasks });
    }
  };

  const handleDeleteSubtask = (subId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEditable) return;
    const nextSubtasks = subtasksList.filter(s => s.id !== subId);
    setSubtasksList(nextSubtasks);
    if (existingTask) {
      updateTask(existingTask.id, { subtasks: nextSubtasks });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > 50 * 1024 * 1024) {
      alert('Файл слишком большой! Максимальный размер: 50 МБ.');
      return;
    }
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        let fileUrl = '';
        let fileSize = file.size;
        try {
          const res = await apiService.uploadFile(file.name, base64);
          if (res.success && res.url) {
            fileUrl = res.url;
            fileSize = res.size || file.size;
          }
        } catch (err) {
          console.warn('⚠️ Загрузка на сервер недоступна, сохраняем вложение локально (Base64)', err);
          fileUrl = base64; // Fallback for offline or local mode
        }

        if (fileUrl) {
          const newAtt: Attachment = {
            id: `att-${Date.now()}`,
            filename: file.name,
            url: fileUrl,
            size: fileSize,
            uploadedAt: new Date().toISOString(),
            uploadedBy: commentUserId || 'usr-1'
          };
          const nextAtts = [...attachmentsList, newAtt];
          setAttachmentsList(nextAtts);
          if (existingTask) {
            updateTask(existingTask.id, { attachments: nextAtts });
          }
        }
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteAttachment = (attId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEditable) return;
    const nextAtts = attachmentsList.filter(a => a.id !== attId);
    setAttachmentsList(nextAtts);
    if (existingTask) {
      updateTask(existingTask.id, { attachments: nextAtts });
    }
  };

  const toggleTimer = () => {
    if (isTimerRunning) {
      setIsTimerRunning(false);
      const addedHours = Number((timerSeconds / 3600).toFixed(2));
      if (addedHours > 0) {
        const nextLogged = Number((loggedHours + addedHours).toFixed(2));
        setLoggedHours(nextLogged);
        if (existingTask) {
          updateTask(existingTask.id, { loggedHours: nextLogged });
        }
      }
      setTimerSeconds(0);
    } else {
      setIsTimerRunning(true);
    }
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSendComment = () => {
    if (!commentText.trim() || !existingTask) return;
    addComment(existingTask.id, commentText, commentUserId);
    setCommentText('');
  };

  const assigneeUser = users.find(u => u.id === assigneeId);
  const assigneeGroup = groups?.find(g => g.id === assigneeGroupId);
  const completedCount = subtasksList.filter(s => s.completed).length;
  const progressPercent = subtasksList.length > 0 ? Math.round((completedCount / subtasksList.length) * 100) : 0;

  return (
    <div className="modal-backdrop animate-fade-in" onClick={onClose}>
      <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-row">
            <span className="modal-task-id">{existingTask ? existingTask.id : 'Новая задача'}</span>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as Status)}
              disabled={!isEditable}
              className={`status-select status-${status}`}
              style={{ opacity: !isEditable ? 0.7 : 1 }}
            >
              {columns.map(c => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>

          <div className="modal-header-actions">
            {existingTask && canDeleteTask() && (
              <button className="icon-btn danger-hover" onClick={handleDelete} title="Удалить задачу">
                <Trash2 size={18} />
              </button>
            )}
            <button className="icon-btn" onClick={onClose} title="Закрыть">
              <X size={18} />
            </button>
          </div>
        </div>

        {!isEditable && (
          <div style={{
            background: 'rgba(234, 179, 8, 0.15)',
            color: '#facc15',
            padding: '10px 20px',
            fontSize: '0.85rem',
            borderBottom: '1px solid rgba(234, 179, 8, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            ⚠️ <strong>Ограничение прав (RBAC):</strong> Вы можете просматривать и комментировать эту задачу, но изменять её параметры могут только Администраторы, Руководители или назначенный исполнитель.
          </div>
        )}

        {/* Body grid */}
        <div className="modal-body">
          <div className="modal-main-col">
            {/* Title Input */}
            <div className="form-group">
              <label className="form-label">Название задачи *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Кратко опишите суть задачи..."
                className="input-field title-input"
              />
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label">Описание задачи (Markdown поддерживается)</label>
              <textarea
                rows={5}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Добавьте подробное описание, требования, ссылки..."
                className="input-field textarea-field"
              />
            </div>

            {/* Subtasks Section */}
            <div className="subtasks-section">
              <div className="section-header">
                <CheckSquare size={16} />
                <span>Чек-лист подзадач ({completedCount}/{subtasksList.length})</span>
              </div>

              {subtasksList.length > 0 && (
                <div className="progress-bar-container">
                  <div className="progress-bar" style={{ width: `${progressPercent}%` }} />
                </div>
              )}

              <div className="subtask-list">
                {subtasksList.map(st => (
                  <div 
                    key={st.id} 
                    className={`subtask-item ${st.completed ? 'completed' : ''}`}
                    onClick={() => handleToggleSubtask(st.id)}
                  >
                    <input 
                      type="checkbox" 
                      checked={st.completed} 
                      onChange={() => {}} 
                      className="subtask-checkbox" 
                    />
                    <span className="subtask-title" style={{ flex: 1 }}>{st.title}</span>
                    {isEditable && (
                      <button 
                        type="button" 
                        onClick={(e) => handleDeleteSubtask(st.id, e)}
                        className="subtask-del-btn"
                        title="Удалить пункт"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {isEditable && (
                <div className="add-subtask-row">
                  <input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={e => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddSubtask())}
                    placeholder="Добавить подзадачу (нажмите Enter)..."
                    className="input-field subtask-input"
                  />
                  <button type="button" className="btn-secondary" onClick={handleAddSubtask}>
                    <Plus size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* Attachments Section (Drag & Drop) */}
            <div className="attachments-section">
              <div className="section-header">
                <Paperclip size={16} />
                <span>Вложения и документы ({attachmentsList.length})</span>
              </div>

              {attachmentsList.length > 0 && (
                <div className="attachments-grid">
                  {attachmentsList.map(att => (
                    <div key={att.id} className="attachment-card">
                      <div className="att-icon-wrapper">
                        <FileText size={20} />
                      </div>
                      <div className="att-info">
                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="att-name" title={att.filename}>
                          {att.filename}
                        </a>
                        <span className="att-meta">
                          {Math.round((att.size || 0) / 1024)} КБ • {new Date(att.uploadedAt || Date.now()).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                      <div className="att-actions">
                        <a href={att.url} download={att.filename} target="_blank" rel="noopener noreferrer" className="icon-btn" title="Скачать">
                          <Download size={15} />
                        </a>
                        {isEditable && (
                          <button type="button" onClick={(e) => handleDeleteAttachment(att.id, e)} className="icon-btn danger-hover" title="Удалить файл">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isEditable && (
                <div 
                  className={`drop-zone-area ${isUploading ? 'uploading' : ''}`}
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={async e => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      const input = fileInputRef.current;
                      if (input) {
                        const dataTransfer = new DataTransfer();
                        dataTransfer.items.add(e.dataTransfer.files[0]);
                        input.files = dataTransfer.files;
                        const event = { target: input } as unknown as React.ChangeEvent<HTMLInputElement>;
                        handleFileUpload(event);
                      }
                    }
                  }}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />
                  <Upload size={24} className="upload-icon-pulse" />
                  <div>
                    <strong>{isUploading ? 'Загрузка файла на сервер...' : 'Нажмите или перетащите файл сюда'}</strong>
                    <p>Документы Word/PDF, таблицы Excel, архивы или скриншоты (до 50 МБ)</p>
                  </div>
                </div>
              )}
            </div>

            {/* Comments Section (Only when editing) */}
            {existingTask && (
              <div className="comments-section">
                <div className="section-header">
                  <MessageSquare size={16} />
                  <span>Активность и Комментарии ({existingTask.comments.length})</span>
                </div>

                <div className="comments-list">
                  {existingTask.comments.map(com => {
                    const isSys = com.isSystemLog || com.text.startsWith('⚡') || com.text.startsWith('👤') || com.text.startsWith('🏢') || com.text.startsWith('🔥') || com.text.startsWith('🤝') || com.text.startsWith('🎉');
                    if (isSys) {
                      return (
                        <div key={com.id} className="comment-item system-log-item" style={{ background: 'rgba(59, 132, 246, 0.08)', borderLeft: '3px solid #3b82f6', padding: '10px 14px', borderRadius: '6px', margin: '6px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '1.3rem' }}>🤖</span>
                          <div className="comment-body" style={{ flex: 1 }}>
                            <div className="comment-meta" style={{ marginBottom: '2px' }}>
                              <span className="comment-author" style={{ color: '#3b82f6', fontWeight: 600 }}>Системный аудит</span>
                              <span className="comment-date">
                                {new Date(com.createdAt).toLocaleString('ru-RU', { 
                                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' 
                                })}
                              </span>
                            </div>
                            <p className="comment-text" style={{ margin: 0, fontWeight: 500, color: 'var(--text-color)' }}>{com.text}</p>
                          </div>
                        </div>
                      );
                    }
                    const comUser = users.find(u => u.id === com.userId);
                    return (
                      <div key={com.id} className="comment-item">
                        <img 
                          src={comUser?.avatar || 'https://via.placeholder.com/40'} 
                          alt={comUser?.name} 
                          className="comment-avatar" 
                        />
                        <div className="comment-body">
                          <div className="comment-meta">
                            <span className="comment-author">{comUser?.name || 'Сотрудник'}</span>
                            <span className="comment-role">({comUser?.role})</span>
                            <span className="comment-date">
                              {new Date(com.createdAt).toLocaleString('ru-RU', { 
                                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
                              })}
                            </span>
                          </div>
                          <p className="comment-text">{com.text}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="add-comment-box">
                  <div className="comment-user-select">
                    <span className="label-tiny">От лица:</span>
                    <select
                      value={commentUserId}
                      onChange={e => setCommentUserId(e.target.value)}
                      className="user-small-select"
                    >
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.department})</option>
                      ))}
                    </select>
                  </div>
                  <div className="comment-input-row">
                    <input
                      type="text"
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleSendComment())}
                      placeholder="Напишите комментарий коллеге..."
                      className="input-field"
                    />
                    <button type="button" className="btn-primary send-btn" onClick={handleSendComment}>
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Grid Col (Metadata) */}
          <div className="modal-side-col">
            {/* Assignee (12 employees or group) */}
            <div className="form-group">
              <label className="form-label">
                <UserIcon size={14} />
                <span>Исполнитель (Сотрудник / Команда)</span>
              </label>
              <div className="assignee-select-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {assigneeUser && (
                  <img src={assigneeUser.avatar} alt={assigneeUser.name} className="select-avatar-preview" />
                )}
                {assigneeGroup && (
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: assigneeGroup.color || '#3b82f6', display: 'inline-block', flexShrink: 0 }} />
                )}
                <select
                  value={assigneeGroupId ? `group:${assigneeGroupId}` : assigneeId ? `user:${assigneeId}` : ''}
                  onChange={e => {
                    const val = e.target.value;
                    if (!val) {
                      setAssigneeId(null);
                      setAssigneeGroupId(null);
                    } else if (val.startsWith('group:')) {
                      setAssigneeGroupId(val.replace('group:', ''));
                      setAssigneeId(null);
                    } else if (val.startsWith('user:')) {
                      setAssigneeId(val.replace('user:', ''));
                      setAssigneeGroupId(null);
                    }
                  }}
                  className="input-field select-field"
                  style={{ flex: 1 }}
                >
                  <option value="">-- Не назначен --</option>
                  <optgroup label="👥 Команды и Группы">
                    {groups?.map(g => (
                      <option key={g.id} value={`group:${g.id}`}>🏢 {g.name} ({g.memberIds.length} чел.)</option>
                    ))}
                  </optgroup>
                  <optgroup label="👤 Одиночные сотрудники">
                    {users.map(u => (
                      <option key={u.id} value={`user:${u.id}`}>👤 {u.name} — {u.role}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              {assigneeGroup && (
                <div className="form-group glass-panel" style={{ padding: '12px', background: 'rgba(59,132,246,0.08)', border: '1px solid rgba(59,132,246,0.2)', borderRadius: '8px', marginTop: '10px' }}>
                  <label className="form-label" style={{ color: 'var(--primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                    <span>🤝 Готовность команды ({assigneeGroup.memberIds.filter(mId => existingTask?.teamReadiness?.[mId]).length}/{assigneeGroup.memberIds.length})</span>
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {assigneeGroup.memberIds.map(mId => {
                      const mem = users.find(u => u.id === mId);
                      const isReady = !!existingTask?.teamReadiness?.[mId];
                      return (
                        <div key={mId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '0.85rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <img src={mem?.avatar || 'https://via.placeholder.com/24'} alt={mem?.name} style={{ width: '20px', height: '20px', borderRadius: '50%' }} />
                            <span>{mem?.name || 'Сотрудник'}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (!existingTask) return;
                              const current = existingTask.teamReadiness || {};
                              const next = { ...current, [mId]: !current[mId] };
                              updateTask(existingTask.id, { teamReadiness: next });
                            }}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background: isReady ? 'rgba(16, 185, 129, 0.2)' : 'rgba(107, 114, 128, 0.2)',
                              color: isReady ? '#10b981' : 'var(--text-muted)',
                              transition: 'all 0.2s'
                            }}
                            title="Нажмите, чтобы подтвердить выполнение своей части работы"
                          >
                            {isReady ? '✅ Готов!' : '⏳ В процессе'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {assigneeGroup.memberIds.length > 0 && assigneeGroup.memberIds.every(mId => existingTask?.teamReadiness?.[mId]) && (
                    <div style={{ marginTop: '8px', padding: '6px', background: 'rgba(16,185,129,0.15)', color: '#10b981', borderRadius: '4px', textAlign: 'center', fontSize: '0.8rem', fontWeight: 600 }}>
                      🎉 Все участники подтвердили готовность!
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Priority */}
            <div className="form-group">
              <label className="form-label">
                <AlertCircle size={14} />
                <span>Приоритет</span>
              </label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as Priority)}
                className={`input-field select-field priority-select-${priority}`}
              >
                <option value="low">Низкий (Low)</option>
                <option value="medium">Средний (Medium)</option>
                <option value="high">Высокий (High)</option>
                <option value="urgent">🔥 Срочно! (Urgent)</option>
              </select>
            </div>

            {/* Sprint */}
            <div className="form-group">
              <label className="form-label">Спринт / Итерация</label>
              <select
                value={sprintId || ''}
                onChange={e => setSprintId(e.target.value || null)}
                className="input-field select-field"
              >
                <option value="">-- Без спринта (Бэклог) --</option>
                {sprints.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Story Points & Estimation */}
            <div className="stats-grid-2">
              <div className="form-group">
                <label className="form-label">Story Points</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={storyPoints}
                  onChange={e => setStoryPoints(parseInt(e.target.value) || 0)}
                  className="input-field number-field"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Оценка (часов)</label>
                <input
                  type="number"
                  min="0"
                  value={estimatedHours}
                  onChange={e => setEstimatedHours(parseInt(e.target.value) || 0)}
                  className="input-field number-field"
                />
              </div>
            </div>

            {/* Logged Hours & Stopwatch Timer */}
            <div className="form-group time-tracking-box">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label className="form-label" style={{ margin: 0 }}>
                  <Clock size={14} />
                  <span>Затрачено времени (часов)</span>
                </label>
                {isEditable && (
                  <button
                    type="button"
                    onClick={toggleTimer}
                    className={`btn-timer-pill ${isTimerRunning ? 'running' : ''}`}
                    title={isTimerRunning ? "Остановить и записать время" : "Запустить секундомер"}
                  >
                    {isTimerRunning ? (
                      <>
                        <Square size={12} fill="#ef4444" />
                        <span>Остановить ({formatTimer(timerSeconds)})</span>
                      </>
                    ) : (
                      <>
                        <Play size={12} fill="#22c55e" />
                        <span>Запустить таймер</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              <input
                type="number"
                min="0"
                step="0.5"
                value={loggedHours}
                onChange={e => setLoggedHours(parseFloat(e.target.value) || 0)}
                className="input-field number-field"
                disabled={!isEditable}
              />
              {estimatedHours > 0 && (
                <div className="time-progress">
                  <div 
                    className="time-bar" 
                    style={{ width: `${Math.min(100, (loggedHours / estimatedHours) * 100)}%` }}
                  />
                  <span className="time-text">{loggedHours}ч из {estimatedHours}ч ({Math.round((loggedHours / estimatedHours) * 100)}%)</span>
                </div>
              )}
            </div>

            {/* Tags */}
            <div className="form-group">
              <label className="form-label">
                <Tag size={14} />
                <span>Теги (Метки)</span>
              </label>
              <div className="tags-container">
                {tags.map((t, idx) => (
                  <span key={idx} className="modal-tag-pill">
                    #{t}
                    <button type="button" onClick={() => handleRemoveTag(t)} className="remove-tag-btn">×</button>
                  </span>
                ))}
              </div>
              <div className="add-tag-row">
                <input
                  type="text"
                  placeholder="Новый тег..."
                  value={newTagInput}
                  onChange={e => setNewTagInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  className="input-field tag-input"
                />
                <button type="button" className="btn-secondary tag-btn" onClick={handleAddTag}>+</button>
              </div>
            </div>

            {/* Meta Dates */}
            {existingTask && (
              <div className="meta-dates">
                <span>Создано: {new Date(existingTask.createdAt).toLocaleDateString('ru-RU')}</span>
                <span>Обновлено: {new Date(existingTask.updatedAt).toLocaleDateString('ru-RU')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Отмена</button>
          <button type="button" className="btn-primary save-btn" onClick={handleSave}>
            {isOpenNew ? 'Создать задачу' : 'Сохранить изменения'}
          </button>
        </div>
      </div>
    </div>
  );
};
