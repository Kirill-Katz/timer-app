import Dexie from 'dexie';
import { db, newId, nowIso } from '../services/local-db';
import { applyTimeLogAggregateMutation, listDurationTotals } from '../services/log-aggregates';
import { enqueueOperation } from '../services/sync-queue';
import type { EditableTimeLog, TimeLog } from '../types';

function localDayKey(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localDayBoundsIso(day: string) {
  const start = new Date(`${day}T00:00:00`);
  const endExclusive = new Date(start);
  endExclusive.setDate(start.getDate() + 1);

  return {
    start: start.toISOString(),
    endExclusive: endExclusive.toISOString()
  };
}

function nextLocalMidnight(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate() + 1);
}

function splitStoppedTimerLog(log: TimeLog, endTime: string): EditableTimeLog[] {
  const start = new Date(log.start_time);
  const end = new Date(endTime);

  if (end.getTime() <= start.getTime()) {
    return [{
      project_id: log.project_id,
      task_id: log.task_id,
      start_time: log.start_time,
      end_time: endTime
    }];
  }

  const segments: EditableTimeLog[] = [];
  let cursor = start;

  while (localDayKey(cursor) !== localDayKey(end)) {
    const boundary = nextLocalMidnight(cursor);
    if (boundary.getTime() >= end.getTime()) break;

    segments.push({
      project_id: log.project_id,
      task_id: log.task_id,
      start_time: cursor.toISOString(),
      end_time: boundary.toISOString()
    });
    cursor = boundary;
  }

  segments.push({
    project_id: log.project_id,
    task_id: log.task_id,
    start_time: cursor.toISOString(),
    end_time: endTime
  });

  return segments;
}

export async function listTimeLogs(userId: string): Promise<TimeLog[]> {
  const logs = await db.time_logs.where('user_id').equals(userId).sortBy('start_time');
  return logs.filter((log) => !log.deleted_at).reverse();
}

export async function countTimeLogs(userId: string): Promise<number> {
  return db.time_logs.where('user_id').equals(userId).filter((log) => !log.deleted_at).count();
}

export async function countProjectTimeLogs(userId: string, projectId: string): Promise<number> {
  return db.time_logs.where('user_id').equals(userId).filter((log) => !log.deleted_at && log.project_id === projectId).count();
}

export async function countTaskTimeLogs(userId: string, taskId: string): Promise<number> {
  return db.time_logs.where('user_id').equals(userId).filter((log) => !log.deleted_at && log.task_id === taskId).count();
}

export async function listTimeLogsPage(userId: string, offset: number, limit: number): Promise<TimeLog[]> {
  return db.time_logs
    .where('[user_id+start_time]')
    .between([userId, Dexie.minKey], [userId, Dexie.maxKey])
    .reverse()
    .filter((log) => !log.deleted_at)
    .offset(offset)
    .limit(limit)
    .toArray();
}

export async function listProjectTimeLogsPage(userId: string, projectId: string, offset: number, limit: number): Promise<TimeLog[]> {
  return db.time_logs
    .where('[user_id+start_time]')
    .between([userId, Dexie.minKey], [userId, Dexie.maxKey])
    .reverse()
    .filter((log) => !log.deleted_at && log.project_id === projectId)
    .offset(offset)
    .limit(limit)
    .toArray();
}

export async function listTaskTimeLogsPage(userId: string, taskId: string, offset: number, limit: number): Promise<TimeLog[]> {
  return db.time_logs
    .where('[user_id+start_time]')
    .between([userId, Dexie.minKey], [userId, Dexie.maxKey])
    .reverse()
    .filter((log) => !log.deleted_at && log.task_id === taskId)
    .offset(offset)
    .limit(limit)
    .toArray();
}

export async function listTimeLogsForGroup(userId: string, day: string, projectId: string, taskId: string | null): Promise<TimeLog[]> {
  const { start, endExclusive } = localDayBoundsIso(day);
  const logs = await db.time_logs
    .where('[user_id+start_time]')
    .between([userId, start], [userId, endExclusive], true, false)
    .filter((log) => !log.deleted_at && log.project_id === projectId && log.task_id === taskId)
    .toArray();

  return logs.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
}

export async function sumTaskTimeLogDurations(userId: string): Promise<Record<string, number>> {
  return listDurationTotals(userId, 'task');
}

export async function sumProjectTimeLogDurations(userId: string): Promise<Record<string, number>> {
  return listDurationTotals(userId, 'project');
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

  await enqueueOperation(userId, 'time_log', log.id, 'create', log, async () => {
    await db.time_logs.put(log);
    await applyTimeLogAggregateMutation(null, log);
  });
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

  await enqueueOperation(userId, 'time_log', log.id, 'update', updated, async () => {
    await db.time_logs.put(updated);
    await applyTimeLogAggregateMutation(log, updated);
  });
  return updated;
}

export async function softDeleteTimeLog(userId: string, log: TimeLog): Promise<void> {
  const updated: TimeLog = {
    ...log,
    deleted_at: nowIso(),
    updated_at: nowIso()
  };

  await enqueueOperation(userId, 'time_log', log.id, 'delete', updated, async () => {
    await db.time_logs.put(updated);
    await applyTimeLogAggregateMutation(log, updated);
  });
}

export async function startTimer(userId: string, projectId: string, taskId: string | null): Promise<TimeLog> {
  return createTimeLog(userId, {
    project_id: projectId,
    task_id: taskId,
    start_time: nowIso(),
    end_time: null
  });
}

export async function stopTimer(userId: string, log: TimeLog): Promise<TimeLog[]> {
  const segments = splitStoppedTimerLog(log, nowIso());
  const [firstSegment, ...remainingSegments] = segments;
  const firstLog = await updateTimeLog(userId, log, firstSegment);
  const additionalLogs: TimeLog[] = [];

  for (const segment of remainingSegments) {
    additionalLogs.push(await createTimeLog(userId, segment));
  }

  return [firstLog, ...additionalLogs];
}
