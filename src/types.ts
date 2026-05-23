export type EntityType = 'project' | 'task' | 'time_log';
export type QueueOperation = 'create' | 'update' | 'delete' | 'archive' | 'unarchive';
export type QueueStatus = 'pending' | 'saved_locally';

export interface BaseRow {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface Project extends BaseRow {
  name: string;
  color: string;
  archived: boolean;
}

export interface Task extends BaseRow {
  project_id: string;
  name: string;
  archived: boolean;
}

export interface TimeLog extends BaseRow {
  project_id: string;
  task_id: string | null;
  start_time: string;
  end_time: string | null;
  deleted_at: string | null;
}

export interface OperationQueueItem {
  id: string;
  user_id: string;
  entity_type: EntityType;
  entity_id: string;
  operation: QueueOperation;
  payload: object;
  status: QueueStatus;
  created_at: string;
}

export interface BootstrapState {
  user_id: string;
  completed_at: string;
}

export interface EditableTimeLog {
  id?: string;
  project_id: string;
  task_id: string | null;
  start_time: string;
  end_time: string | null;
}
