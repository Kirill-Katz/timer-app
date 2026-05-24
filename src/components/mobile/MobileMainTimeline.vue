<script setup lang="ts">
import { Play, Square } from 'lucide-vue-next';
import type { TimeTrackerAppContext } from '../../composables/useTimeTrackerApp';

withDefaults(defineProps<{
  app: TimeTrackerAppContext;
  liveTimer?: boolean;
}>(), {
  liveTimer: true
});
</script>

<template>
  <section class="flex min-h-[calc(100vh-7rem)] flex-col gap-6 py-4">
    <header class="px-1">
      <h1 class="text-2xl font-medium leading-none text-ink">Timeline</h1>
    </header>
    <div v-if="app.runningLog" class="rounded-lg border border-sage/30 bg-sage/10 p-3">
      <div class="flex items-center justify-between gap-3">
        <button class="min-w-0 flex-1 text-left" type="button" @click="app.openLogEditor(app.runningLog)">
          <div class="flex items-center gap-2">
            <span class="h-3 w-3 flex-none rounded-full border border-black/10" :style="{ backgroundColor: app.projectById(app.runningLog.project_id)?.color ?? '#777' }"></span>
            <p class="truncate font-medium">{{ app.projectById(app.runningLog.project_id)?.name ?? 'Running' }}</p>
          </div>
          <p class="truncate text-sm font-normal text-stone-300">{{ app.taskById(app.runningLog.task_id)?.name ?? 'No task' }}</p>
        </button>
        <button class="btn-danger inline-flex h-11 w-32 items-center justify-center gap-2 rounded-xl px-4 font-medium tabular-nums" type="button" @click="app.endTimer">
          <Square :size="18" /> {{ liveTimer ? app.formatDuration(app.runningLog.start_time, null) : 'Tracking' }}
        </button>
      </div>
    </div>
    <div class="min-h-0 flex-1 pb-24">
      <section v-for="group in app.groupedLogs" :key="group.label" class="mt-5 grid gap-2 first:mt-0">
        <div class="flex items-center justify-between gap-3 px-1">
          <h2 class="text-xl font-medium">{{ group.label }}</h2>
          <span class="text-sm font-normal text-stone-300">{{ app.formatDurationMs(group.totalMs) }}</span>
        </div>
        <article v-for="entry in group.entries" :key="`${group.label}-${entry.projectId}-${entry.taskId ?? 'none'}-${entry.latestStart}`" class="grid grid-cols-[1fr_auto] gap-3 border-b border-line px-1 py-2" @click="app.openLogDetail(app.dayKey(entry.latestStart), entry.projectId, entry.taskId)">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="h-3 w-3 flex-none rounded-full border border-black/10" :style="{ backgroundColor: app.projectById(entry.projectId)?.color ?? '#777' }"></span>
              <p class="truncate text-sm font-normal">{{ app.projectById(entry.projectId)?.name ?? 'Unknown project' }}</p>
            </div>
            <p v-if="app.taskById(entry.taskId)" class="truncate text-xs font-normal text-stone-300">{{ app.taskById(entry.taskId)?.name }}</p>
          </div>
          <button class="glass-start inline-flex h-8 w-28 shrink-0 items-center justify-center gap-1 rounded-full px-2.5 text-xs font-normal tabular-nums" type="button" @click.stop="app.switchTimer(entry.projectId, entry.taskId)">
            <Play :size="14" fill="currentColor" /> {{ app.formatDurationMs(entry.totalMs) }}
          </button>
        </article>
      </section>
      <p v-if="app.loadingMoreLogs" class="px-1 py-4 text-center text-sm font-normal text-stone-300">Loading older logs...</p>
      <p v-else-if="!app.hasMoreLogs && app.groupedLogs.length" class="px-1 py-4 text-center text-sm font-normal text-stone-500">Reached the end of loaded history.</p>
      <p v-if="!app.groupedLogs.length" class="px-1 py-10 text-center text-sm font-normal text-stone-300">No time logs yet.</p>
    </div>
  </section>
</template>
