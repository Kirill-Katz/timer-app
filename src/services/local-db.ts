import Dexie, { type Table } from 'dexie';
import type { BootstrapState, LogAggregate, OperationQueueItem, Project, Task, TimeLog } from '../types';

class TimeTrackerDatabase extends Dexie {
  projects!: Table<Project, string>;
  tasks!: Table<Task, string>;
  time_logs!: Table<TimeLog, string>;
  log_aggregates!: Table<LogAggregate, string>;
  operation_queue!: Table<OperationQueueItem, string>;
  bootstrap_state!: Table<BootstrapState, string>;

  constructor() {
    super('offline_time_tracker');
    this.version(2).stores({
      projects: 'id, archived, created_at, updated_at',
      tasks: 'id, project_id, archived, created_at, updated_at',
      time_logs: 'id, project_id, task_id, start_time, deleted_at, updated_at',
      operation_queue: 'id, status, created_at'
    });
    this.version(3).stores({
      projects: 'id, user_id, [user_id+archived], created_at, updated_at',
      tasks: 'id, user_id, project_id, [user_id+project_id], [user_id+archived], created_at, updated_at',
      time_logs: 'id, user_id, project_id, task_id, start_time, [user_id+start_time], deleted_at, updated_at',
      operation_queue: 'id, user_id, status, created_at, [user_id+created_at]'
    });
    this.version(4).stores({
      projects: 'id, user_id, [user_id+archived], created_at, updated_at',
      tasks: 'id, user_id, project_id, [user_id+project_id], [user_id+archived], created_at, updated_at',
      time_logs: 'id, user_id, project_id, task_id, start_time, [user_id+start_time], deleted_at, updated_at',
      operation_queue: 'id, user_id, status, created_at, [user_id+created_at]',
      bootstrap_state: 'user_id, completed_at'
    });
    this.version(5).stores({
      projects: 'id, user_id, [user_id+archived], created_at, updated_at',
      tasks: 'id, user_id, project_id, [user_id+project_id], [user_id+archived], created_at, updated_at',
      time_logs: 'id, user_id, project_id, task_id, start_time, [user_id+start_time], deleted_at, updated_at',
      log_aggregates: 'id, user_id, entity_type, entity_id, [user_id+entity_type], updated_at',
      operation_queue: 'id, user_id, status, created_at, [user_id+created_at]',
      bootstrap_state: 'user_id, completed_at'
    });
  }
}

export const db = new TimeTrackerDatabase();

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function getPendingOperationCount(userId: string): Promise<number> {
  return db.operation_queue.where('user_id').equals(userId).count();
}

export async function hasCompletedBootstrap(userId: string): Promise<boolean> {
  return Boolean(await db.bootstrap_state.get(userId));
}

export async function markBootstrapComplete(userId: string): Promise<void> {
  await db.bootstrap_state.put({
    user_id: userId,
    completed_at: nowIso()
  });
}
