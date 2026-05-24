<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { TimeTrackerAppContext } from '../composables/useTimeTrackerApp';
import type { TimeLog } from '../types';

const DEFAULT_DAY_WIDTH_PX = 96;
const HOUR_HEIGHT_PX = 46;
const HOURS_PER_DAY = 24;
const CHUNK_DAYS = 7;
const MAX_RENDERED_DAYS = 28;
const INITIAL_PAST_DAYS = 7;
const INITIAL_FUTURE_DAYS = 14;

type CalendarSegment = {
  id: string;
  log: TimeLog;
  title: string;
  color: string;
  startMs: number;
  endMs: number;
  top: number;
  height: number;
  lane: number;
  laneCount: number;
  isRunning: boolean;
};

type CalendarDay = {
  key: string;
  label: string;
  caption: string;
  isToday: boolean;
  segments: CalendarSegment[];
};

const props = defineProps<{
  app: TimeTrackerAppContext;
}>();

const viewportRef = ref<HTMLElement | null>(null);
const daysRef = ref<HTMLElement | null>(null);
const rangeStart = ref<Date>(new Date());
const rangeEnd = ref<Date>(new Date());
let restoringScroll = false;
let edgeLoadLock: 'past' | 'future' | null = null;

type ScrollAnchor = {
  dayKey: string;
  offset: number;
  dayOffsetLeft: number;
};

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addDays(value: Date, count: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + count);
  return next;
}

function differenceInDays(left: Date, right: Date) {
  return Math.round((left.getTime() - right.getTime()) / 86_400_000);
}

function formatDayKey(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function eventTitle(log: TimeLog) {
  const taskName = props.app.taskById(log.task_id)?.name;
  if (taskName) return taskName;
  return props.app.projectById(log.project_id)?.name ?? 'Unknown project';
}

function eventColor(log: TimeLog) {
  return props.app.projectById(log.project_id)?.color ?? '#7ef2bc';
}

function initialAnchorDate() {
  const latestLog = props.app.reportLogs.find((log) => !log.deleted_at);
  const anchor = latestLog ? new Date(latestLog.start_time) : new Date();
  anchor.setDate(anchor.getDate() - 3);
  return startOfDay(anchor);
}

function initializeRange() {
  const anchor = initialAnchorDate();
  rangeStart.value = addDays(anchor, -INITIAL_PAST_DAYS);
  rangeEnd.value = addDays(anchor, INITIAL_FUTURE_DAYS);
}

function segmentOverlaps(a: CalendarSegment, b: CalendarSegment) {
  return a.startMs < b.endMs && b.startMs < a.endMs;
}

function layoutSegments(segments: CalendarSegment[]) {
  const laidOut = segments
    .sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs)
    .map((segment) => ({ ...segment }));

  const active: CalendarSegment[] = [];

  laidOut.forEach((segment) => {
    for (let index = active.length - 1; index >= 0; index -= 1) {
      if (active[index].endMs <= segment.startMs) {
        active.splice(index, 1);
      }
    }

    let lane = 0;
    while (active.some((entry) => entry.lane === lane && segmentOverlaps(entry, segment))) {
      lane += 1;
    }

    segment.lane = lane;
    active.push(segment);

    const cluster = laidOut.filter((entry) => segmentOverlaps(entry, segment) || entry.id === segment.id);
    const laneCount = Math.max(...cluster.map((entry) => entry.lane), lane) + 1;
    cluster.forEach((entry) => {
      entry.laneCount = Math.max(entry.laneCount, laneCount);
    });
  });

  return laidOut;
}

function buildSegmentsForDay(dayStart: Date, logs: TimeLog[]) {
  const dayStartMs = dayStart.getTime();
  const dayEndMs = addDays(dayStart, 1).getTime();

  const segments = logs.flatMap((log) => {
    const startMs = new Date(log.start_time).getTime();
    const endMs = new Date(log.end_time ?? new Date().toISOString()).getTime();
    if (endMs <= dayStartMs || startMs >= dayEndMs) return [];

    const clippedStart = Math.max(startMs, dayStartMs);
    const clippedEnd = Math.min(endMs, dayEndMs);
    const top = ((clippedStart - dayStartMs) / 3_600_000) * HOUR_HEIGHT_PX;
    const height = Math.max(14, ((clippedEnd - clippedStart) / 3_600_000) * HOUR_HEIGHT_PX);

    return [{
      id: `${log.id}:${formatDayKey(dayStart)}`,
      log,
      title: eventTitle(log),
      color: eventColor(log),
      startMs: clippedStart,
      endMs: clippedEnd,
      top,
      height,
      lane: 0,
      laneCount: 1,
      isRunning: !log.end_time
    } satisfies CalendarSegment];
  });

  return layoutSegments(segments);
}

const activeLogs = computed(() => props.app.reportLogs.filter((log) => !log.deleted_at));

const days = ref<CalendarDay[]>([]);

function createCalendarDay(dayStart: Date, logs: TimeLog[] = activeLogs.value) {
  const todayKey = formatDayKey(startOfDay(new Date()));
  return {
    key: formatDayKey(dayStart),
    label: new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(dayStart),
    caption: new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(dayStart),
    isToday: formatDayKey(dayStart) === todayKey,
    segments: buildSegmentsForDay(dayStart, logs)
  } satisfies CalendarDay;
}

function buildDayRange(start: Date, end: Date, logs: TimeLog[] = activeLogs.value) {
  const items: CalendarDay[] = [];
  for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
    items.push(createCalendarDay(cursor, logs));
  }
  return items;
}

function rebuildDays(logs: TimeLog[] = activeLogs.value) {
  days.value = buildDayRange(rangeStart.value, rangeEnd.value, logs);
}

const hourLabels = Array.from({ length: HOURS_PER_DAY }, (_, hour) => {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
});

function openLog(log: TimeLog) {
  props.app.openLogEditor(log);
}

function dayWidthPx() {
  const firstDay = daysRef.value?.querySelector<HTMLElement>('.calendar-day');
  return firstDay?.getBoundingClientRect().width ?? DEFAULT_DAY_WIDTH_PX;
}

function edgeThresholdPx() {
  return dayWidthPx() * 2;
}

function captureScrollAnchor(viewport: HTMLElement): ScrollAnchor | null {
  const width = dayWidthPx();
  if (!days.value.length || width <= 0) return null;

  const index = Math.max(0, Math.min(days.value.length - 1, Math.floor(viewport.scrollLeft / width)));
  const day = days.value[index];
  const dayElement = daysRef.value?.querySelector<HTMLElement>(`[data-day-key="${day?.key ?? ''}"]`);
  if (!day) return null;

  return {
    dayKey: day.key,
    offset: viewport.scrollLeft - (index * width),
    dayOffsetLeft: dayElement?.offsetLeft ?? (index * width)
  };
}

function restoreScrollAnchor(anchor: ScrollAnchor) {
  const viewport = viewportRef.value;
  const day = daysRef.value?.querySelector<HTMLElement>(`[data-day-key="${anchor.dayKey}"]`);
  if (!viewport || !day) return false;

  const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
  const nextScrollLeft = viewport.scrollLeft + (day.offsetLeft - anchor.dayOffsetLeft);
  viewport.scrollLeft = Math.min(Math.max(0, nextScrollLeft), maxScrollLeft);
  return true;
}

function scrollToAnchorDay() {
  if (!viewportRef.value) return;
  const targetIndex = INITIAL_PAST_DAYS;
  viewportRef.value.scrollLeft = targetIndex * dayWidthPx();
  edgeLoadLock = null;
}

async function adjustRange(direction: 'past' | 'future') {
  const viewport = viewportRef.value;
  if (!viewport || restoringScroll) return;

  restoringScroll = true;

  const previousStart = rangeStart.value;
  const anchor = captureScrollAnchor(viewport);
  const previousScrollLeft = viewport.scrollLeft;
  let nextStart = rangeStart.value;
  let nextEnd = rangeEnd.value;
  let nextDays = days.value;

  if (direction === 'past') {
    nextStart = addDays(rangeStart.value, -CHUNK_DAYS);
    nextDays = [
      ...buildDayRange(nextStart, addDays(rangeStart.value, -1)),
      ...days.value
    ];
    if (days.value.length + CHUNK_DAYS > MAX_RENDERED_DAYS) {
      nextEnd = addDays(rangeEnd.value, -CHUNK_DAYS);
      nextDays = nextDays.slice(0, nextDays.length - CHUNK_DAYS);
    }
  } else {
    nextEnd = addDays(rangeEnd.value, CHUNK_DAYS);
    nextDays = [
      ...days.value,
      ...buildDayRange(addDays(rangeEnd.value, 1), nextEnd)
    ];
    if (days.value.length + CHUNK_DAYS > MAX_RENDERED_DAYS) {
      nextStart = addDays(rangeStart.value, CHUNK_DAYS);
      nextDays = nextDays.slice(CHUNK_DAYS);
    }
  }

  const offsetDays = differenceInDays(previousStart, nextStart);
  const nextScrollLeft = previousScrollLeft + (offsetDays * dayWidthPx());

  rangeStart.value = nextStart;
  rangeEnd.value = nextEnd;
  days.value = nextDays;

  await nextTick();

  const updatedViewport = viewportRef.value;
  if (updatedViewport) {
    const maxScrollLeft = Math.max(0, updatedViewport.scrollWidth - updatedViewport.clientWidth);
    const restored = anchor ? restoreScrollAnchor(anchor) : false;
    if (!restored) {
      updatedViewport.scrollLeft = Math.min(Math.max(0, nextScrollLeft), maxScrollLeft);
    }
  }

  edgeLoadLock = direction;
  restoringScroll = false;
}

function handleHorizontalScroll() {
  const viewport = viewportRef.value;
  if (!viewport || restoringScroll) return;

  const remainingRight = viewport.scrollWidth - viewport.clientWidth - viewport.scrollLeft;
  const threshold = edgeThresholdPx();

  if (edgeLoadLock === 'past' && viewport.scrollLeft > threshold) {
    edgeLoadLock = null;
  } else if (edgeLoadLock === 'future' && remainingRight > threshold) {
    edgeLoadLock = null;
  }

  if (viewport.scrollLeft <= threshold && edgeLoadLock !== 'past') {
    void adjustRange('past');
    return;
  }

  if (remainingRight <= threshold && edgeLoadLock !== 'future') {
    void adjustRange('future');
  }
}

onMounted(() => {
  initializeRange();
  rebuildDays();
  void nextTick(scrollToAnchorDay);
});

watch(() => props.app.calendarOpen, (open) => {
  if (!open) return;
  initializeRange();
  rebuildDays();
  void nextTick(scrollToAnchorDay);
});

watch(activeLogs, (logs) => {
  rebuildDays(logs);
}, { deep: true });

onBeforeUnmount(() => {
  restoringScroll = false;
});
</script>

<template>
  <section class="grid min-h-0">
    <div class="calendar-board rounded-lg border border-line bg-panel/70 shadow-soft">
      <div class="calendar-board__layout">
        <div class="calendar-hours">
          <div class="calendar-hours__spacer"></div>
          <div v-for="label in hourLabels" :key="label" class="calendar-hours__label">{{ label }}</div>
        </div>

        <div
          ref="viewportRef"
          class="calendar-board__viewport"
          @scroll.passive="handleHorizontalScroll"
        >
          <div ref="daysRef" class="calendar-board__days">
            <div
              v-for="day in days"
              :key="day.key"
              class="calendar-day"
              :class="{ 'calendar-day--today': day.isToday }"
              :data-day-key="day.key"
            >
              <div class="calendar-day__heading">
                <p class="calendar-day__label">{{ day.label }}</p>
                <p class="calendar-day__caption">{{ day.caption }}</p>
              </div>
              <div class="calendar-day__body">
                <div v-for="hour in HOURS_PER_DAY" :key="`${day.key}:${hour}`" class="calendar-day__slot"></div>
                <button
                  v-for="segment in day.segments"
                  :key="segment.id"
                  class="calendar-entry"
                  type="button"
                  :title="segment.title"
                  :style="{
                    top: `${segment.top}px`,
                    height: `${segment.height}px`,
                    left: `calc(${(segment.lane / segment.laneCount) * 100}% + 0.2rem)`,
                    width: `calc(${100 / segment.laneCount}% - 0.4rem)`,
                    backgroundColor: segment.color,
                    color: '#09110d'
                  }"
                  @click="openLog(segment.log)"
                >
                  <span v-if="segment.height >= 24" class="calendar-entry__title">{{ segment.title }}</span>
                  <span v-if="segment.isRunning && segment.height >= 40" class="calendar-entry__meta">Running</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
