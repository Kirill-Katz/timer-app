<script setup lang="ts">
import type { TimeTrackerAppContext } from '../../composables/useTimeTrackerApp';
import MobileBottomSheet from './MobileBottomSheet.vue';

defineProps<{
  app: TimeTrackerAppContext;
}>();
</script>

<template>
  <MobileBottomSheet :show="app.menuSheetOpen" z-class="z-[80]" min-height-class="min-h-0" @close="app.closeSheets">
    <div class="grid gap-2">
      <button class="inline-flex min-h-12 items-center justify-start rounded-xl border-0 bg-panel px-4 text-left font-normal text-ink transition hover:bg-white/5 active:scale-[0.99]" type="button" @click="app.openTimeline('replace')">Timeline</button>
      <button class="inline-flex min-h-12 items-center justify-start rounded-xl border-0 bg-panel px-4 text-left font-normal text-ink transition hover:bg-white/5 active:scale-[0.99]" type="button" @click="app.openReports('replace')">Reports</button>
      <button class="inline-flex min-h-12 items-center justify-start rounded-xl border-0 bg-panel px-4 text-left font-normal text-ink transition hover:bg-white/5 active:scale-[0.99]" type="button">Timers</button>
      <button class="inline-flex min-h-12 items-center justify-start rounded-xl border-0 bg-panel px-4 text-left font-normal text-ink transition hover:bg-white/5 active:scale-[0.99]" type="button" @click="app.openCalendar('replace')">Calendar</button>
      <button class="inline-flex min-h-12 items-center justify-start rounded-xl border-0 bg-panel px-4 text-left font-normal text-ink transition hover:bg-white/5 active:scale-[0.99]" type="button" @click="app.openSettings('replace')">Settings</button>
    </div>
  </MobileBottomSheet>
</template>
