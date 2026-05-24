<script setup lang="ts">
import type { TimeTrackerAppContext } from '../../composables/useTimeTrackerApp';
import MobileBottomSheet from './MobileBottomSheet.vue';

defineProps<{
  app: TimeTrackerAppContext;
}>();
</script>

<template>
  <MobileBottomSheet :show="app.menuSheetOpen" z-class="z-[80]" @close="app.closeSheets">
    <div class="grid gap-2">
      <button class="btn-primary inline-flex min-h-12 items-center justify-start rounded-xl px-4 text-left font-normal" type="button" @click="app.openTimeline('replace')">Timeline</button>
      <button class="btn-primary inline-flex min-h-12 items-center justify-start rounded-xl px-4 text-left font-normal" type="button" @click="app.openReports('replace')">Reports</button>
      <button class="btn-primary inline-flex min-h-12 items-center justify-start rounded-xl px-4 text-left font-normal" type="button">Timers</button>
      <button class="btn-primary inline-flex min-h-12 items-center justify-start rounded-xl px-4 text-left font-normal" type="button" @click="app.openCalendar('replace')">Calendar</button>
      <button class="btn-primary inline-flex min-h-12 items-center justify-start rounded-xl px-4 text-left font-normal" type="button" @click="app.openSettings('replace')">Settings</button>
    </div>
  </MobileBottomSheet>
</template>
