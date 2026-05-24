import { durationBetweenMs } from './useTimeLogDuration';

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

const dayLabelFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'short',
  day: 'numeric'
});

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});

const titleDateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

export function formatDurationMs(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function formatDuration(start: string, end: string | null, nowMs = Date.now()) {
  return formatDurationMs(durationBetweenMs(start, end ? new Date(end).getTime() : nowMs));
}

export function formatDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value));
}

export function dayLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return dayLabelFormatter.format(date);
}

export function dayKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

export function formatTime(value: string) {
  return timeFormatter.format(new Date(value));
}

export function toDateLocal(iso: string) {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

export function toTimeLocal(iso: string) {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(11, 19);
}

export function fromDateAndTimeLocal(date: string, time: string) {
  return new Date(`${date}T${time}`).toISOString();
}

export function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function addDays(value: Date, count: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + count);
  return next;
}

export function toDateInputValue(value: Date) {
  const offset = value.getTimezoneOffset();
  return new Date(value.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function dateInputToLocalStart(value: string) {
  return new Date(`${value}T00:00:00`);
}

export function formatTitleDate(value: Date) {
  return titleDateFormatter.format(value);
}
