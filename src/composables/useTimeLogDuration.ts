import type { TimeLog } from '../types';

export function durationBetweenMs(start: string, endMs: number): number {
  return Math.max(0, endMs - new Date(start).getTime());
}

export function completedTimeLogDurationMs(log: TimeLog | null | undefined): number {
  if (!log?.end_time || log.deleted_at) return 0;
  return durationBetweenMs(log.start_time, new Date(log.end_time).getTime());
}

export function timeLogDurationMs(log: TimeLog, nowMs = Date.now()): number {
  const endMs = log.end_time ? new Date(log.end_time).getTime() : nowMs;
  return durationBetweenMs(log.start_time, endMs);
}

export function useTimeLogDuration(nowMs: () => number = Date.now) {
  return {
    completedTimeLogDurationMs,
    timeLogDurationMs: (log: TimeLog) => timeLogDurationMs(log, nowMs())
  };
}
