<script setup lang="ts">
import { Pencil, Trash2 } from 'lucide-vue-next';
import type { TimeTrackerAppContext } from '../../composables/useTimeTrackerApp';

defineProps<{
  app: TimeTrackerAppContext;
}>();
</script>

<template>
  <section class="rounded-lg border border-line bg-panel p-4 shadow-soft xl:col-span-2">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-xl font-medium">Time logs</h2>
    </div>
    <div class="grid gap-2">
      <article
        v-for="log in app.visibleLogs"
        :key="log.id"
        v-memo="[log.project_id, log.task_id, log.start_time, log.end_time, log.deleted_at, log.end_time ? 0 : app.ticker, app.projectById(log.project_id)?.name, app.projectById(log.project_id)?.color, app.taskById(log.task_id)?.name]"
        class="grid cursor-pointer grid-cols-[1fr_auto_auto] items-start gap-3 rounded-lg border border-line bg-panel p-3 transition hover:border-sage"
        tabindex="0"
        role="button"
        @click="app.openLogEditor(log)"
        @keydown.enter.prevent="app.openLogEditor(log)"
        @keydown.space.prevent="app.openLogEditor(log)"
      >
        <div class="grid min-w-0 gap-1">
          <div class="flex items-center gap-2">
            <span class="h-3 w-3 flex-none rounded-full border border-black/10" :style="{ backgroundColor: app.projectById(log.project_id)?.color ?? '#777' }"></span>
            <strong class="truncate font-normal">{{ app.projectById(log.project_id)?.name ?? 'Unknown project' }}</strong>
          </div>
          <span class="text-sm text-stone-300">{{ app.taskById(log.task_id)?.name ?? 'No task' }} · {{ app.formatDateTime(log.start_time) }} · {{ app.formatDuration(log.start_time, log.end_time) }}</span>
        </div>
        <button class="btn-primary inline-flex min-h-10 w-10 items-center justify-center rounded-lg" type="button" title="Edit log" @click.stop="app.openLogEditor(log)">
          <Pencil :size="18" />
        </button>
        <button class="inline-flex min-h-10 w-10 items-center justify-center rounded-lg bg-red-700 text-white" type="button" title="Delete log" @click.stop="app.deleteLog(log)">
          <Trash2 :size="18" />
        </button>
      </article>
    </div>
  </section>
</template>
