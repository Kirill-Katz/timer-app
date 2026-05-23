import { db, newId, nowIso } from '../services/local-db';
import { enqueueOperation } from '../services/sync-queue';
import type { EditableTimeLog, TimeLog } from '../types';

export async function listTimeLogs(userId: string): Promise<TimeLog[]> {
  const logs = await db.time_logs.where('user_id').equals(userId).sortBy('start_time');
  return logs.filter((log) => !log.deleted_at).reverse();
}

export async function getRunningLog(userId: string): Promise<TimeLog | undefined> {
  const logs = await db.time_logs.where('user_id').equals(userId).toArray();
  return logs.find((log) => !log.end_time && !log.deleted_at);
}

export async function createTimeLog(userId: string, input: EditableTimeLog): Promise<TimeLog> {
  const timestamp = nowIso();
  const log: TimeLog = {
    id: input.id ?? newId(),
    user_id: userId,
    project_id: input.project_id,
    task_id: input.task_id,
    start_time: input.start_time,
    end_time: input.end_time,
    deleted_at: null,
    created_at: timestamp,
    updated_at: timestamp
  };

  await enqueueOperation(userId, 'time_log', log.id, 'create', log, () => db.time_logs.put(log));
  return log;
}

export async function updateTimeLog(userId: string, log: TimeLog, input: EditableTimeLog): Promise<TimeLog> {
  const updated: TimeLog = {
    ...log,
    project_id: input.project_id,
    task_id: input.task_id,
    start_time: input.start_time,
    end_time: input.end_time,
    updated_at: nowIso()
  };

  await enqueueOperation(userId, 'time_log', log.id, 'update', updated, () => db.time_logs.put(updated));
  return updated;
}

export async function softDeleteTimeLog(userId: string, log: TimeLog): Promise<void> {
  const updated: TimeLog = {
    ...log,
    deleted_at: nowIso(),
    updated_at: nowIso()
  };

  await enqueueOperation(userId, 'time_log', log.id, 'delete', updated, () => db.time_logs.put(updated));
}

export async function startTimer(userId: string, projectId: string, taskId: string | null): Promise<TimeLog> {
  return createTimeLog(userId, {
    project_id: projectId,
    task_id: taskId,
    start_time: nowIso(),
    end_time: null
  });
}

export async function stopTimer(userId: string, log: TimeLog): Promise<TimeLog> {
  return updateTimeLog(userId, log, {
    project_id: log.project_id,
    task_id: log.task_id,
    start_time: log.start_time,
    end_time: nowIso()
  });
}
