<script setup lang="ts">
import { Menu } from 'lucide-vue-next';
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import CalendarPanel from './CalendarPanel.vue';
import { isWindowNearBottom } from '../composables/useNearBottomScroll';
import type { TimeTrackerAppContext } from '../composables/useTimeTrackerApp';
import ReportsPanel from './ReportsPanel.vue';
import SettingsPanel from './SettingsPanel.vue';
import MobileEditPickerSheet from './mobile/MobileEditPickerSheet.vue';
import MobileLogDetailOverlay from './mobile/MobileLogDetailOverlay.vue';
import MobileLogEditorOverlay from './mobile/MobileLogEditorOverlay.vue';
import MobileMainTimeline from './mobile/MobileMainTimeline.vue';
import MobileMenuSheet from './mobile/MobileMenuSheet.vue';
import MobilePageOverlay from './mobile/MobilePageOverlay.vue';
import MobileProjectLogDetailOverlay from './mobile/MobileProjectLogDetailOverlay.vue';
import MobileProjectsSheet from './mobile/MobileProjectsSheet.vue';

const props = defineProps<{
  app: TimeTrackerAppContext;
}>();

const lastTimelineScrollTop = ref(0);
let ensuringTimelineFill = false;

function isMainTimelinePage() {
  return !props.app.reportsOpen
    && !props.app.settingsOpen
    && !props.app.calendarOpen
    && !props.app.editingLogId
    && !props.app.detailGroup
    && !props.app.projectLogDetailProjectId;
}

function isMainTimelineVisible() {
  return isMainTimelinePage()
    && !props.app.menuSheetOpen
    && !props.app.projectsSheetOpen
    && !props.app.editPickerMode;
}

async function ensureTimelineFill() {
  if (ensuringTimelineFill || !isMainTimelineVisible()) return;

  ensuringTimelineFill = true;
  try {
    while (props.app.hasMoreLogs && !props.app.loadingMoreLogs) {
      await nextTick();
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });

      if (!isMainTimelineVisible() || !isWindowNearBottom(240)) break;
      await props.app.loadMoreLogs();
    }
  } finally {
    ensuringTimelineFill = false;
  }
}

async function restoreTimelineScrollPosition() {
  await nextTick();
  requestAnimationFrame(() => {
    window.scrollTo({ top: props.app.timelineScrollTop, behavior: 'auto' });
    lastTimelineScrollTop.value = props.app.timelineScrollTop;
  });
}

function handleWindowScroll() {
  const nextScrollTop = window.scrollY;
  props.app.setTimelineScrollTop(nextScrollTop);

  const scrollingDown = nextScrollTop > lastTimelineScrollTop.value;
  lastTimelineScrollTop.value = nextScrollTop;
  if (!scrollingDown || !props.app.hasMoreLogs || props.app.loadingMoreLogs) return;

  if (isWindowNearBottom(240)) {
    void props.app.loadMoreLogs();
  }
}

onMounted(() => {
  window.addEventListener('scroll', handleWindowScroll, { passive: true });
  void ensureTimelineFill();
});

onUnmounted(() => {
  window.removeEventListener('scroll', handleWindowScroll);
});

watch(
  () => [props.app.reportsOpen, props.app.settingsOpen, props.app.calendarOpen, props.app.editingLogId, props.app.detailGroup?.day ?? null],
  async ([reportsOpen, settingsOpen, calendarOpen, editingLogId, detailDay], [previousReportsOpen, previousSettingsOpen, previousCalendarOpen, previousEditingLogId, previousDetailDay]) => {
    const isMainTimeline = !reportsOpen && !settingsOpen && !calendarOpen && !editingLogId && !detailDay;
    const wasMainTimeline = !previousReportsOpen && !previousSettingsOpen && !previousCalendarOpen && !previousEditingLogId && !previousDetailDay;
    if (!isMainTimeline || wasMainTimeline) return;
    await restoreTimelineScrollPosition();
    void ensureTimelineFill();
  },
  { flush: 'post' }
);

watch(
  () => [props.app.groupedLogs.length, props.app.loadingMoreLogs, props.app.hasMoreLogs],
  ([, loadingMoreLogs, hasMoreLogs]) => {
    if (!loadingMoreLogs && hasMoreLogs) {
      void ensureTimelineFill();
    }
  },
  { flush: 'post' }
);
</script>

<template>
  <section class="relative sm:hidden">
    <MobileMainTimeline v-if="isMainTimelinePage()" :app="app" :live-timer="isMainTimelineVisible()" />

    <nav v-if="!app.editingLogId && !app.detailGroup && !app.projectLogDetailProjectId && !app.menuSheetOpen && !app.projectsSheetOpen && !app.editPickerMode" class="fixed inset-x-0 bottom-0 z-[70] bg-panel/95 px-3 py-2 shadow-soft">
      <div v-if="app.reportsOpen || app.settingsOpen || app.calendarOpen" class="flex">
        <button class="inline-flex min-h-12 w-12 items-center justify-center rounded-xl border-0 bg-transparent text-ink" type="button" title="Menu" @click="app.openMenuSheet()">
          <Menu :size="22" />
        </button>
      </div>
      <div v-else class="grid grid-cols-[3.5rem_1fr_3.5rem] items-center gap-2">
        <button class="inline-flex min-h-12 items-center justify-center rounded-xl border-0 bg-transparent text-ink" type="button" title="Menu" @click="app.openMenuSheet()">
          <Menu :size="22" />
        </button>
        <button class="btn-primary inline-flex min-h-12 items-center justify-center rounded-xl px-4 font-normal" type="button" @click="app.openProjectsSheet()">
          Projects
        </button>
        <button class="min-h-12 rounded-xl bg-transparent" type="button" aria-hidden="true" tabindex="-1"></button>
      </div>
    </nav>

    <MobileMenuSheet :app="app" />
    <MobileProjectsSheet :app="app" />

    <MobilePageOverlay :show="app.reportsOpen" title="" content-class="py-5 pb-24">
      <ReportsPanel :app="app" mobile-heading />
    </MobilePageOverlay>

    <MobilePageOverlay :show="app.calendarOpen" title="Calendar" content-class="pt-5 px-0 pb-0">
      <CalendarPanel :app="app" />
    </MobilePageOverlay>

    <MobilePageOverlay :show="app.settingsOpen" title="Settings">
      <SettingsPanel :app="app" mobile />
    </MobilePageOverlay>

    <MobileLogDetailOverlay :app="app" />
    <MobileProjectLogDetailOverlay :app="app" />

    <MobileLogEditorOverlay :app="app" />
    <MobileEditPickerSheet :app="app" />
  </section>
</template>
