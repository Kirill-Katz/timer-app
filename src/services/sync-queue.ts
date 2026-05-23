import { db, getPendingOperationCount, hasCompletedBootstrap, markBootstrapComplete, newId } from './local-db';
import { rebuildLogAggregates } from './log-aggregates';
import Dexie from 'dexie';
import { supabase } from './supabase';
import type { EntityType, OperationQueueItem, Project, QueueOperation, Task, TimeLog } from '../types';

type SyncListener = (state: SyncState) => void;

export interface SyncState {
  online: boolean;
  syncing: boolean;
  pendingCount: number;
  lastError: string | null;
}

const listeners = new Set<SyncListener>();
let syncing = false;
let intervalId: number | undefined;
const bootstrappingUsers = new Set<string>();

export function subscribeSyncState(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function emit(userId: string | null, lastError: string | null = null) {
  const pendingCount = userId ? await getPendingOperationCount(userId) : 0;
  const state: SyncState = {
    online: navigator.onLine,
    syncing,
    pendingCount,
    lastError
  };

  listeners.forEach((listener) => listener(state));
}

export async function enqueueOperation(
  userId: string,
  entityType: EntityType,
  entityId: string,
  operation: QueueOperation,
  payload: object,
  applyLocal: () => Promise<unknown>
): Promise<void> {
  const op: OperationQueueItem = {
    id: newId(),
    user_id: userId,
    entity_type: entityType,
    entity_id: entityId,
    operation,
    payload,
    status: 'pending',
    created_at: new Date().toISOString()
  };

  await db.transaction('rw', [db.operation_queue, db.projects, db.tasks, db.time_logs, db.log_aggregates], async () => {
    await db.operation_queue.add(op);
    await applyLocal();
    await db.operation_queue.update(op.id, { status: 'saved_locally' });
  });

  await emit(userId);
  void syncQueue(userId);
}

export function startBackgroundSync(userId: string): () => void {
  const onOnline = () => void syncQueue(userId);
  const onOffline = () => void emit(userId);

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  intervalId = window.setInterval(() => {
    if (navigator.onLine) {
      void syncQueue(userId);
    } else {
      void emit(userId);
    }
  }, 30_000);

  void syncQueue(userId);

  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    if (intervalId) {
      window.clearInterval(intervalId);
      intervalId = undefined;
    }
  };
}

export async function ensureBootstrapData(userId: string, requireOnline = true): Promise<boolean> {
  if (await hasCompletedBootstrap(userId)) {
    return false;
  }

  if (!navigator.onLine) {
    if (requireOnline) {
      throw new Error('Initial download requires an internet connection.');
    }

    await emit(userId);
    return false;
  }

  if (bootstrappingUsers.has(userId)) {
    await emit(userId);
    return false;
  }

  bootstrappingUsers.add(userId);

  try {
    await reloadFromRemote(userId);
    return true;
  } finally {
    bootstrappingUsers.delete(userId);
    await emit(userId);
  }
}

export async function reloadFromRemote(userId: string): Promise<void> {
  if (!navigator.onLine) {
    throw new Error('Remote synchronization requires an internet connection.');
  }

  await hydrateFromRemote(userId);
  await markBootstrapComplete(userId);
}

export async function syncQueue(userId: string): Promise<void> {
  if (syncing || !navigator.onLine) {
    await emit(userId);
    return;
  }

  syncing = true;
  await emit(userId);

  let lastError: string | null = null;

  try {
    while (navigator.onLine) {
      const front = await db.operation_queue
        .where('[user_id+created_at]')
        .between([userId, Dexie.minKey], [userId, Dexie.maxKey])
        .first();

      if (!front) {
        break;
      }

      if (front.status !== 'saved_locally') {
        break;
      }

      const { error } = await syncOperation(front);
      if (error) {
        lastError = error.message;
        break;
      }

      await db.operation_queue.delete(front.id);
      await emit(userId);
    }
  } finally {
    syncing = false;
    await emit(userId, lastError);
  }
}

async function syncOperation(op: OperationQueueItem): Promise<{ error: Error | null }> {
  try {
    const table = tableFor(op.entity_type);
    const payload = withRemoteSyncFields(op);

    if (op.entity_type === 'time_log' && op.operation === 'delete') {
      const { error } = await supabase.from(table).upsert(payload);
      return { error: error ? new Error(error.message) : null };
    }

    if (op.operation === 'create' || op.operation === 'update' || op.operation === 'archive' || op.operation === 'unarchive') {
      const { error } = await supabase.from(table).upsert(payload);
      return { error: error ? new Error(error.message) : null };
    }

    return { error: new Error(`Unsupported operation: ${op.operation}`) };
  } catch (error) {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }
}

function tableFor(entityType: EntityType): 'projects' | 'tasks' | 'time_logs' {
  if (entityType === 'project') return 'projects';
  if (entityType === 'task') return 'tasks';
  return 'time_logs';
}

function withRemoteSyncFields(op: OperationQueueItem): Record<string, unknown> {
  return op.payload as Record<string, unknown>;
}

export async function hydrateFromRemote(userId: string): Promise<void> {
  if (!navigator.onLine) return;

  const [projects, tasks, timeLogs] = await Promise.all([
    fetchAllRows<Project>('projects', userId),
    fetchAllRows<Task>('tasks', userId),
    fetchAllRows<TimeLog>('time_logs', userId)
  ]);

  await db.transaction('rw', db.projects, db.tasks, db.time_logs, async () => {
    await db.projects.where('user_id').equals(userId).delete();
    await db.tasks.where('user_id').equals(userId).delete();
    await db.time_logs.where('user_id').equals(userId).delete();

    if (projects.length) {
      await db.projects.bulkPut(projects);
    }
    if (tasks.length) {
      await db.tasks.bulkPut(tasks);
    }
    if (timeLogs.length) {
      await db.time_logs.bulkPut(timeLogs);
    }
  });

  await rebuildLogAggregates(userId);
}

async function fetchAllRows<T>(table: 'projects' | 'tasks' | 'time_logs', userId: string, pageSize = 1000): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .range(from, to);

    if (error) {
      throw error;
    }

    const page = (data ?? []) as T[];
    rows.push(...page);

    if (page.length < pageSize) {
      break;
    }
  }

  return rows;
}
