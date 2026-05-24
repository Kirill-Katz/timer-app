import type { GroupedLogEntry, GroupedLogSection, Task, TimeLog } from '../types';
import { dayLabel } from './useDateTimeFormatters';

export function compareTasks(a: Task, b: Task) {
  return Number(Boolean(a.completed)) - Number(Boolean(b.completed)) || a.created_at.localeCompare(b.created_at);
}

export function sortTasksByStatus(taskList: Task[]) {
  return taskList.slice().sort(compareTasks);
}

export function sortLogsDesc(logList: TimeLog[]) {
  return logList.slice().sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
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
  logList.forEach((log) => {
    const label = dayLabel(log.start_time);
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
    if (new Date(log.start_time).getTime() > new Date(entry.latestStart).getTime()) {
      entry.latestStart = log.start_time;
    }
    group.totalMs += duration;
    group.entries.set(key, entry);
    groups.set(label, group);
  });

  return Array.from(groups.entries(), ([label, group]) => ({
    label,
    totalMs: group.totalMs,
    entries: Array.from(group.entries.values()).sort((a, b) => new Date(b.latestStart).getTime() - new Date(a.latestStart).getTime())
  }));
}
