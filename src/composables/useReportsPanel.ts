import { onClickOutside } from '@vueuse/core';
import { computed, ref } from 'vue';
import type { ChartData, ChartOptions } from 'chart.js';
import type { TimeTrackerAppContext } from './useTimeTrackerApp';
import type { TimeLog } from '../types';
import { addDays, dateInputToLocalStart, formatTitleDate, startOfLocalDay, toDateInputValue } from './useDateTimeFormatters';
import { normalizeProjectColor, withAlpha } from './useProjectColors';

export type Aggregation = 'day' | 'week' | 'month';
export type PresetRange = '7d' | '30d' | '180d' | '365d' | 'lifetime' | 'custom';

type BucketProjectSegment = {
  projectId: string;
  projectName: string;
  color: string;
  ms: number;
  hours: number;
};

type ReportBucket = {
  label: string;
  hours: number;
  segments: BucketProjectSegment[];
};

export function useReportsPanel(app: TimeTrackerAppContext) {
  const aggregation = ref<Aggregation>('day');
  const rangePreset = ref<PresetRange>('30d');
  const customFrom = ref('');
  const customTo = ref('');
  const controlsOpen = ref(false);
  const controlsRef = ref<HTMLElement | null>(null);

  const aggregationOptions: Array<{ value: Aggregation; label: string }> = [
    { value: 'day', label: 'Per day' },
    { value: 'week', label: 'Per week' },
    { value: 'month', label: 'Per month' }
  ];

  const rangeOptions: Array<{ value: PresetRange; label: string }> = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '180d', label: 'Last 180 days' },
    { value: '365d', label: 'Last 365 days' },
    { value: 'lifetime', label: 'Lifetime' },
    { value: 'custom', label: 'Custom range' }
  ];

  const timelineStartDate = computed(() => {
    if (!app.reportLogs.length) return '';
    return toDateInputValue(new Date(app.reportLogs[app.reportLogs.length - 1].start_time));
  });

  const timelineEndDate = computed(() => toDateInputValue(new Date()));

  const resolvedCustomFrom = computed(() => customFrom.value || timelineStartDate.value);
  const resolvedCustomTo = computed(() => customTo.value || timelineEndDate.value);
  const selectedAggregationLabel = computed(() => aggregationOptions.find((option) => option.value === aggregation.value)?.label ?? 'Per day');
  const selectedRangeLabel = computed(() => rangeOptions.find((option) => option.value === rangePreset.value)?.label ?? 'Last 30 days');

  const rangeBounds = computed(() => {
    const today = startOfLocalDay(new Date());
    const tomorrow = addDays(today, 1);
    let start: Date;
    let endExclusive: Date;

    if (rangePreset.value === 'custom') {
      if (!resolvedCustomFrom.value || !resolvedCustomTo.value) return null;
      start = dateInputToLocalStart(resolvedCustomFrom.value);
      const to = dateInputToLocalStart(resolvedCustomTo.value);
      if (start.getTime() > to.getTime()) return null;
      endExclusive = addDays(to, 1);
    } else if (rangePreset.value === 'lifetime') {
      const firstLog = app.reportLogs[app.reportLogs.length - 1];
      start = firstLog ? startOfLocalDay(new Date(firstLog.start_time)) : today;
      endExclusive = tomorrow;
    } else {
      const dayCount = rangePreset.value === '7d'
        ? 7
        : rangePreset.value === '30d'
          ? 30
          : rangePreset.value === '180d'
            ? 180
            : 365;

      start = addDays(today, -(dayCount - 1));
      endExclusive = tomorrow;
    }

    const alignedStart = floorToBucket(start, aggregation.value);
    const alignedEndExclusive = addBucket(
      floorToBucket(new Date(endExclusive.getTime() - 1), aggregation.value),
      aggregation.value
    );

    return {
      start: alignedStart,
      endExclusive: alignedEndExclusive
    };
  });

  const reportSeries = computed(() => {
    const bounds = rangeBounds.value;
    if (!bounds) return { buckets: [], projectOrder: [], totalMs: 0 };

    const bucketStarts = buildBucketStarts(bounds.start, bounds.endExclusive, aggregation.value);
    const totals = new Map<number, number>(bucketStarts.map((date) => [date.getTime(), 0]));
    const projectTotals = new Map<string, number>();
    const bucketProjectTotals = new Map<number, Map<string, number>>(
      bucketStarts.map((date) => [date.getTime(), new Map<string, number>()])
    );
    let totalMs = 0;

    for (const log of app.reportLogs) {
      const clipped = clipLogToRange(log, bounds.start.getTime(), bounds.endExclusive.getTime(), app.ticker);
      if (!clipped) continue;

      totalMs += clipped.end - clipped.start;

      let cursor = clipped.start;
      while (cursor < clipped.end) {
        const bucketStart = floorToBucket(new Date(cursor), aggregation.value);
        const bucketKey = bucketStart.getTime();
        const bucketEnd = addBucket(bucketStart, aggregation.value).getTime();
        const segmentEnd = Math.min(clipped.end, bucketEnd);
        const segmentMs = segmentEnd - cursor;
        const bucketProjects = bucketProjectTotals.get(bucketKey) ?? new Map<string, number>();
        totals.set(bucketKey, (totals.get(bucketKey) ?? 0) + segmentMs);
        bucketProjects.set(log.project_id, (bucketProjects.get(log.project_id) ?? 0) + segmentMs);
        bucketProjectTotals.set(bucketKey, bucketProjects);
        projectTotals.set(log.project_id, (projectTotals.get(log.project_id) ?? 0) + segmentMs);
        cursor = segmentEnd;
      }
    }

    const projectMeta = new Map<string, { name: string; color: string; index: number }>(
      app.projects.map((project, index) => [
        project.id,
        {
          name: project.name,
          color: normalizeProjectColor(project),
          index
        }
      ])
    );

    const projectOrder = Array.from(projectTotals.entries())
      .sort((a, b) => {
        const totalDiff = b[1] - a[1];
        if (totalDiff !== 0) return totalDiff;
        const projectA = projectMeta.get(a[0]);
        const projectB = projectMeta.get(b[0]);
        if (projectA && projectB) return projectA.index - projectB.index;
        if (projectA) return -1;
        if (projectB) return 1;
        return a[0].localeCompare(b[0]);
      })
      .map(([projectId]) => projectId);

    return {
      buckets: bucketStarts.map((start) => {
        const bucketKey = start.getTime();
        const bucketProjects = bucketProjectTotals.get(bucketKey) ?? new Map<string, number>();
        const segments = projectOrder
          .map((projectId) => {
            const ms = bucketProjects.get(projectId) ?? 0;
            if (!ms) return null;
            const meta = projectMeta.get(projectId);
            return {
              projectId,
              projectName: meta?.name ?? 'Unknown project',
              color: meta?.color ?? '#7ef2bc',
              ms,
              hours: roundHours(ms / 3_600_000)
            };
          })
          .filter((segment): segment is BucketProjectSegment => Boolean(segment));

        return {
          label: formatBucketLabel(start, aggregation.value),
          hours: roundHours((totals.get(bucketKey) ?? 0) / 3_600_000),
          segments
        } satisfies ReportBucket;
      }),
      projectOrder,
      totalMs
    };
  });

  const chartData = computed<ChartData<'bar'>>(() => ({
    labels: reportSeries.value.buckets.map((bucket) => bucket.label),
    datasets: reportSeries.value.projectOrder.map((projectId, datasetIndex, projectIds) => {
      const project = app.projects.find((entry) => entry.id === projectId);
      const baseColor = normalizeProjectColor(project);
      return {
        label: project?.name ?? 'Unknown project',
        data: reportSeries.value.buckets.map((bucket) => bucket.segments.find((segment) => segment.projectId === projectId)?.hours ?? 0),
        backgroundColor: withAlpha(baseColor, 0.82),
        borderColor: withAlpha(baseColor, 1),
        borderWidth: 1,
        borderRadius: {
          topLeft: datasetIndex === projectIds.length - 1 ? 8 : 0,
          topRight: datasetIndex === projectIds.length - 1 ? 8 : 0,
          bottomLeft: datasetIndex === 0 ? 8 : 0,
          bottomRight: datasetIndex === 0 ? 8 : 0
        },
        borderSkipped: false,
        hoverBackgroundColor: withAlpha(baseColor, 0.94),
        hoverBorderColor: withAlpha(baseColor, 1),
        maxBarThickness: 28,
        stack: 'tracked-hours'
      };
    })
  }));

  const chartOptions = computed<ChartOptions<'bar'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 240,
      easing: 'easeOutCubic'
    },
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        filter(context) {
          return Number(context.parsed.y ?? 0) > 0;
        },
        callbacks: {
          label(context) {
            const value = Number(context.parsed.y ?? 0);
            return `${context.dataset.label}: ${formatDurationLabel(value, app)}`;
          },
          beforeBody(items) {
            const bucket = reportSeries.value.buckets[items[0]?.dataIndex ?? -1];
            return bucket ? [`Total: ${formatDurationLabel(bucket.hours, app)}`] : [];
          }
        }
      }
    },
    scales: {
      x: {
        stacked: true,
        grid: {
          display: false
        },
        ticks: {
          color: '#d6d3d1',
          maxRotation: 0,
          autoSkip: true
        }
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: {
          color: 'rgba(255,255,255,0.08)'
        },
        ticks: {
          color: '#d6d3d1',
          callback(value) {
            return formatDurationAxisLabel(Number(value), app);
          }
        }
      }
    }
  }));

  const totalLabel = computed(() => app.formatDurationMs(reportSeries.value.totalMs));
  const hasData = computed(() => reportSeries.value.buckets.length > 0);
  const hasLogs = computed(() => app.reportLogs.length > 0);
  const activeRangeTitle = computed(() => {
    const bounds = rangeBounds.value;
    if (!bounds) return selectedRangeLabel.value;

    const startLabel = formatTitleDate(bounds.start);
    const endLabel = formatTitleDate(addDays(bounds.endExclusive, -1));
    return `${selectedRangeLabel.value} ${startLabel} - ${endLabel}`;
  });
  const controlsSummary = computed(() => `${selectedAggregationLabel.value} • ${selectedRangeLabel.value}`);

  onClickOutside(controlsRef, () => {
    controlsOpen.value = false;
  });

  return {
    aggregation,
    aggregationOptions,
    activeRangeTitle,
    chartData,
    chartOptions,
    controlsOpen,
    controlsRef,
    controlsSummary,
    customFrom,
    customTo,
    hasData,
    hasLogs,
    rangeBounds,
    rangeOptions,
    rangePreset,
    resolvedCustomFrom,
    resolvedCustomTo,
    selectedAggregationLabel,
    timelineEndDate,
    timelineStartDate,
    totalLabel
  };
}

function clipLogToRange(log: TimeLog, rangeStart: number, rangeEnd: number, nowMs: number) {
  const logStart = new Date(log.start_time).getTime();
  const logEnd = log.end_time ? new Date(log.end_time).getTime() : nowMs;
  const start = Math.max(logStart, rangeStart);
  const end = Math.min(logEnd, rangeEnd);
  if (end <= start) return null;
  return { start, end };
}

function buildBucketStarts(start: Date, endExclusive: Date, mode: Aggregation) {
  const buckets: Date[] = [];
  let cursor = floorToBucket(start, mode);
  while (cursor.getTime() < endExclusive.getTime()) {
    buckets.push(new Date(cursor));
    cursor = addBucket(cursor, mode);
  }
  return buckets;
}

function floorToBucket(value: Date, mode: Aggregation) {
  if (mode === 'month') {
    return new Date(value.getFullYear(), value.getMonth(), 1);
  }

  if (mode === 'week') {
    const start = startOfLocalDay(value);
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    return addDays(start, diff);
  }

  return startOfLocalDay(value);
}

function addBucket(value: Date, mode: Aggregation) {
  if (mode === 'month') {
    return new Date(value.getFullYear(), value.getMonth() + 1, 1);
  }
  return addDays(value, mode === 'week' ? 7 : 1);
}

function formatBucketLabel(value: Date, mode: Aggregation) {
  if (mode === 'month') {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      year: 'numeric'
    }).format(value);
  }

  if (mode === 'week') {
    const end = addDays(value, 6);
    const sameMonth = value.getMonth() === end.getMonth() && value.getFullYear() === end.getFullYear();
    const startText = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric'
    }).format(value);
    const endText = new Intl.DateTimeFormat(undefined, sameMonth
      ? { day: 'numeric' }
      : { month: 'short', day: 'numeric' }).format(end);
    return `${startText} - ${endText}`;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric'
  }).format(value);
}

function roundHours(value: number) {
  return Math.round(value * 100) / 100;
}

function formatDurationLabel(hours: number, app: TimeTrackerAppContext) {
  return app.formatDurationMs(Math.round(hours * 3_600_000));
}

function formatDurationAxisLabel(hours: number, app: TimeTrackerAppContext) {
  const formatted = app.formatDurationMs(Math.round(hours * 3_600_000));
  return formatted.slice(0, 5);
}
