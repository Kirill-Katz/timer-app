import type { Project } from '../types';

export function normalizeProjectColor(project: Project | undefined, fallback = '#7ef2bc') {
  return project?.color || fallback;
}

export function withAlpha(color: string, alpha: number) {
  const normalized = color.trim();
  if (!normalized.startsWith('#')) return normalized;

  const hex = normalized.slice(1);
  const expanded = hex.length === 3 ? hex.split('').map((char) => `${char}${char}`).join('') : hex;
  if (expanded.length !== 6) return normalized;

  const r = Number.parseInt(expanded.slice(0, 2), 16);
  const g = Number.parseInt(expanded.slice(2, 4), 16);
  const b = Number.parseInt(expanded.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
