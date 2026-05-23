import { db, nowIso } from './local-db';
import { completedTimeLogDurationMs } from '../composables/useTimeLogDuration';
import type { LogAggregate, TimeLog } from '../types';

function aggregateId(userId: string, entityType: 'project' | 'task', entityId: string): string {
  return `${userId}:${entityType}:${entityId}`;
}

async function applyAggregateDelta(userId: string, entityType: 'project' | 'task', entityId: string | null, deltaMs: number): Promise<void> {
  if (!entityId || deltaMs === 0) return;

  const id = aggregateId(userId, entityType, entityId);
  const existing = await db.log_aggregates.get(id);
  const nextTotal = Math.max(0, (existing?.total_ms ?? 0) + deltaMs);

  if (!nextTotal) {
    if (existing) {
      await db.log_aggregates.delete(id);
    }
    return;
  }

  const row: LogAggregate = {
    id,
    user_id: userId,
    entity_type: entityType,
    entity_id: entityId,
    total_ms: nextTotal,
    updated_at: nowIso()
  };

  await db.log_aggregates.put(row);
}

async function removeLogContribution(log: TimeLog | null | undefined): Promise<void> {
  if (!log) return;
  const durationMs = completedTimeLogDurationMs(log);
  if (!durationMs) return;

  await applyAggregateDelta(log.user_id, 'project', log.project_id, -durationMs);
  await applyAggregateDelta(log.user_id, 'task', log.task_id, -durationMs);
}

async function addLogContribution(log: TimeLog | null | undefined): Promise<void> {
  if (!log) return;
  const durationMs = completedTimeLogDurationMs(log);
  if (!durationMs) return;

  await applyAggregateDelta(log.user_id, 'project', log.project_id, durationMs);
  await applyAggregateDelta(log.user_id, 'task', log.task_id, durationMs);
}

export async function applyTimeLogAggregateMutation(previous: TimeLog | null | undefined, next: TimeLog | null | undefined): Promise<void> {
  await removeLogContribution(previous);
  await addLogContribution(next);
}

export async function rebuildLogAggregates(userId: string): Promise<void> {
  const logs = await db.time_logs.where('user_id').equals(userId).toArray();
  const aggregates = new Map<string, LogAggregate>();

  for (const log of logs) {
    const durationMs = completedTimeLogDurationMs(log);
    if (!durationMs) continue;

    const projectId = aggregateId(userId, 'project', log.project_id);
    const projectAggregate = aggregates.get(projectId) ?? {
      id: projectId,
      user_id: userId,
      entity_type: 'project',
      entity_id: log.project_id,
      total_ms: 0,
      updated_at: nowIso()
    };
    projectAggregate.total_ms += durationMs;
    aggregates.set(projectId, projectAggregate);

    if (log.task_id) {
      const taskId = aggregateId(userId, 'task', log.task_id);
      const taskAggregate = aggregates.get(taskId) ?? {
        id: taskId,
        user_id: userId,
        entity_type: 'task',
        entity_id: log.task_id,
        total_ms: 0,
        updated_at: nowIso()
      };
      taskAggregate.total_ms += durationMs;
      aggregates.set(taskId, taskAggregate);
    }
  }

  await db.transaction('rw', db.log_aggregates, async () => {
    await db.log_aggregates.where('user_id').equals(userId).delete();
    if (aggregates.size) {
      await db.log_aggregates.bulkPut([...aggregates.values()]);
    }
  });
}

export async function listDurationTotals(userId: string, entityType: 'project' | 'task'): Promise<Record<string, number>> {
  const rows = await db.log_aggregates.where('[user_id+entity_type]').equals([userId, entityType]).toArray();
  return Object.fromEntries(rows.map((row) => [row.entity_id, row.total_ms]));
}

export async function hasLogAggregates(userId: string): Promise<boolean> {
  return (await db.log_aggregates.where('user_id').equals(userId).count()) > 0;
}
