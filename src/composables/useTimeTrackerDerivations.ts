import type { GroupedLogEntry, GroupedLogSection, Project, Task, TimeLog } from '../types';
import { dayLabel } from './useDateTimeFormatters';

function compareActivityTimestampDesc(left: string | undefined, right: string | undefined) {
  if (left && right && left !== right) {
    return right.localeCompare(left);
  }

  if (left) return -1;
  if (right) return 1;
  return 0;
}

export function buildLatestStartMaps(logList: TimeLog[]) {
  const projectLatestStartById = new Map<string, string>();
  const taskLatestStartById = new Map<string, string>();

  logList.forEach((log) => {
    if (log.deleted_at) return;

    const latestProjectStart = projectLatestStartById.get(log.project_id);
    if (!latestProjectStart || log.start_time > latestProjectStart) {
      projectLatestStartById.set(log.project_id, log.start_time);
    }

    if (log.task_id) {
      const latestTaskStart = taskLatestStartById.get(log.task_id);
      if (!latestTaskStart || log.start_time > latestTaskStart) {
        taskLatestStartById.set(log.task_id, log.start_time);
      }
    }
  });

  return {
    projectLatestStartById,
    taskLatestStartById
  };
}

export function sortProjectsByRecentActivity(projectList: Project[], latestStartById: Map<string, string> = new Map()) {
  return projectList.slice().sort((a, b) => {
    return Number(Boolean(a.archived)) - Number(Boolean(b.archived))
      || compareActivityTimestampDesc(latestStartById.get(a.id), latestStartById.get(b.id))
      || b.created_at.localeCompare(a.created_at);
  });
}

export function compareTasks(a: Task, b: Task, latestStartById: Map<string, string> = new Map()) {
  return Number(Boolean(a.completed)) - Number(Boolean(b.completed))
    || Number(Boolean(a.archived)) - Number(Boolean(b.archived))
    || compareActivityTimestampDesc(latestStartById.get(a.id), latestStartById.get(b.id))
    || b.created_at.localeCompare(a.created_at);
}

export function sortTasksByStatus(taskList: Task[], latestStartById: Map<string, string> = new Map()) {
  return taskList.slice().sort((a, b) => compareTasks(a, b, latestStartById));
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
