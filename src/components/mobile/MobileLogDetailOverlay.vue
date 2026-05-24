<script setup lang="ts">
import type { TimeTrackerAppContext } from '../../composables/useTimeTrackerApp';
import MobileCenteredHeader from './MobileCenteredHeader.vue';
import MobileLogRow from './MobileLogRow.vue';
import MobileOverlay from './MobileOverlay.vue';

defineProps<{
  app: TimeTrackerAppContext;
}>();
</script>

<template>
  <MobileOverlay :show="Boolean(app.detailGroup)">
    <MobileCenteredHeader
      v-if="app.detailGroup"
      class="mb-4"
      :title="app.projectById(app.detailGroup.projectId)?.name ?? 'Unknown project'"
      :subtitle="app.taskById(app.detailGroup.taskId)?.name ?? ''"
      :color="app.projectById(app.detailGroup.projectId)?.color ?? '#777'"
      @back="app.closeLogDetail"
    />
    <div class="grid gap-2">
      <MobileLogRow
        v-for="log in app.detailLogs"
        :key="log.id"
        :log="log"
        :time-label="`${app.formatTime(log.start_time)} - ${log.end_time ? app.formatTime(log.end_time) : 'Running'}`"
        :duration-label="app.formatDuration(log.start_time, log.end_time)"
        @open="app.openLogEditor"
      />
    </div>
  </MobileOverlay>
</template>
