export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export type Status = 'todo' | 'in-progress' | 'review' | 'done';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Comment {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
  isSystemLog?: boolean;
}

export interface Attachment {
  id: string;
  filename: string;
  url: string;
  size?: number;
  uploadedAt: string;
  uploadedBy: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  assigneeId: string | null;
  assigneeGroupId?: string | null;
  creatorId?: string;
  creatorName?: string;
  dueDate?: string;
  storyPoints: number;
  estimatedHours: number;
  loggedHours: number;
  subtasks: Subtask[];
  comments: Comment[];
  attachments?: Attachment[];
  tags: string[];
  teamReadiness?: Record<string, boolean>;
  externalFindingId?: string;
  createdAt: string;
  updatedAt: string;
  sprintId: string | null;
}

export interface User {
  id: string;
  name: string;
  role: string;
  avatar: string;
  department: string;
  email: string;
  login?: string;
  password?: string;
  roleType?: 'admin' | 'manager' | 'member';
  pin?: string;
  telegramChatId?: string;
  isActive?: boolean;
  isOnline?: boolean;
}

export interface Group {
  id: string;
  name: string;
  color: string;
  memberIds: string[];
}

export interface Column {
  id: Status;
  title: string;
  color: string;
}

export interface Sprint {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  goal: string;
  isActive: boolean;
}

export interface FilterState {
  search: string;
  assigneeId: string | null;
  priority: Priority | 'all';
  tag: string | 'all';
  sprintId: string | 'all';
  myTasksOnly?: boolean;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  type: 'task_assigned' | 'status_changed' | 'comment_added' | 'general';
  linkTaskId?: string;
}

export type ViewMode = 'board' | 'backlog' | 'workload' | 'analytics' | 'security' | 'profile' | 'admin' | 'help';

export interface ExternalFinding {
  id: string;
  source: 'derscanner' | 'siem' | 'waf' | 'custom';
  title: string;
  description: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';
  project?: string;
  cwe?: string;
  fileLocation?: string;
  status: 'new' | 'analyzing' | 'false-positive' | 'false_positive' | 'resolved' | 'promoted';
  promotedTaskId?: string | null;
  rawPayload?: any;
  createdAt: string;
}

export interface ApiKeySettings {
  id: string;
  name: string;
  key: string;
  source: 'derscanner' | 'siem' | 'waf' | 'custom';
  createdAt: string;
  lastUsedAt?: string | null;
  allowedDepartments?: string[];
}
