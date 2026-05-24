import type { GroupedLogEntry, GroupedLogSection, Task, TimeLog } from '../types';
import { dayLabel } from './useDateTimeFormatters';

export function compareTasks(a: Task, b: Task) {
  return Number(Boolean(a.completed)) - Number(Boolean(b.completed)) || a.created_at.localeCompare(b.created_at);
}

export function sortTasksByStatus(taskList: Task[]) {
  return taskList.slice().sort(compareTasks);
}

export function sortLogsDesc(logList: TimeLog[]) {
  return logList.slice().sort((a, b) => Date.parse(b.start_time) - Date.parse(a.start_time));
}

export function updateDurationTotal(totals: Record<string, number>, key: string | null, deltaMs: number) {
  if (!key || !deltaMs) return totals;

  const nextTotal = Math.max(0, (totals[key] ?? 0) + deltaMs);
  if (nextTotal) {
    return {
      ...totals,
      [key]: nextTotal
    };
  }

  const { [key]: _removed, ...rest } = totals;
  return rest;
}

export function buildGroupedLogs(logList: TimeLog[], logDurationMs: (log: TimeLog) => number): GroupedLogSection[] {
  const groups = new Map<string, { totalMs: number; entries: Map<string, GroupedLogEntry> }>();
  const dayLabelCache = new Map<string, string>();
  const timestampCache = new Map<string, number>();

  logList.forEach((log) => {
    const label = dayLabelCache.get(log.start_time) ?? dayLabel(log.start_time);
    dayLabelCache.set(log.start_time, label);
    const group = groups.get(label) ?? { totalMs: 0, entries: new Map<string, GroupedLogEntry>() };
    const duration = logDurationMs(log);
    const key = `${log.project_id}:${log.task_id ?? 'none'}`;
    const entry = group.entries.get(key) ?? {
      projectId: log.project_id,
      taskId: log.task_id,
      totalMs: 0,
      latestStart: log.start_time
    };

    entry.totalMs += duration;
    const logStartMs = timestampCache.get(log.start_time) ?? Date.parse(log.start_time);
    timestampCache.set(log.start_time, logStartMs);
    const entryStartMs = timestampCache.get(entry.latestStart) ?? Date.parse(entry.latestStart);
    timestampCache.set(entry.latestStart, entryStartMs);
    if (logStartMs > entryStartMs) {
      entry.latestStart = log.start_time;
    }
    group.totalMs += duration;
    group.entries.set(key, entry);
    groups.set(label, group);
  });

  return Array.from(groups.entries(), ([label, group]) => ({
    label,
    totalMs: group.totalMs,
    entries: Array.from(group.entries.values()).sort((a, b) => {
      const left = timestampCache.get(a.latestStart) ?? Date.parse(a.latestStart);
      const right = timestampCache.get(b.latestStart) ?? Date.parse(b.latestStart);
      timestampCache.set(a.latestStart, left);
      timestampCache.set(b.latestStart, right);
      return right - left;
    })
  }));
}
