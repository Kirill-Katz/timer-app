<script setup lang="ts">
import { Archive, ArchiveRestore, Clock, Play, Square } from 'lucide-vue-next';
import type { TimeTrackerAppContext } from '../../composables/useTimeTrackerApp';

defineProps<{
  app: TimeTrackerAppContext;
}>();
</script>

<template>
  <section class="rounded-lg border border-line bg-panel p-4 shadow-soft xl:col-span-2">
    <div class="mb-3 flex items-center justify-between gap-3">
      <h2 class="text-xl font-medium">Timer</h2>
    </div>
    <div v-if="app.selectedProject" class="mb-4 grid gap-2 rounded-lg border border-line bg-panel p-3 sm:grid-cols-[1fr_3.25rem_2.75rem]">
      <input v-model="app.selectedProject.name" class="min-h-11 rounded-lg border border-line bg-panel px-3 font-normal text-ink" @blur="app.saveSelectedProject" />
      <input v-model="app.selectedProject.color" class="h-11 w-full rounded-lg border border-line bg-panel p-1" type="color" aria-label="Selected project color" @change="app.saveSelectedProject" />
      <button class="btn-primary inline-flex min-h-11 items-center justify-center rounded-lg" type="button" :title="app.selectedProject.archived ? 'Unarchive project' : 'Archive project'" @click="app.toggleProjectArchive(app.selectedProject)">
        <ArchiveRestore v-if="app.selectedProject.archived" :size="18" />
        <Archive v-else :size="18" />
      </button>
    </div>
    <div class="flex min-h-32 items-center justify-center gap-3 rounded-lg border border-sage/30 bg-sage/10 text-ink">
      <Clock :size="24" />
      <strong class="text-[clamp(2.35rem,13vw,5.5rem)] font-medium leading-none">{{ app.runningLog ? app.formatDuration(app.runningLog.start_time, null) : '00:00:00' }}</strong>
    </div>
    <div class="sticky bottom-3 z-10 mt-4 grid gap-2 rounded-lg border border-line bg-panel/95 p-2 shadow-soft backdrop-blur sm:static sm:grid-cols-[1fr_auto] sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
      <select v-model="app.selectedTaskId" class="min-h-12 rounded-lg border border-line bg-panel px-3 text-ink">
        <option :value="null">No task</option>
        <option v-for="task in app.activeTasks" :key="task.id" :value="task.id">{{ task.name }}</option>
      </select>
      <button v-if="!app.runningLog" class="glass-start inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-5 font-normal disabled:opacity-50" type="button" :disabled="!app.canStartTimer" @click="app.beginTimer">
        <Play :size="18" /> Start
      </button>
      <button v-else class="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-red-700 px-5 font-medium text-white" type="button" @click="app.endTimer">
        <Square :size="18" /> Stop
      </button>
    </div>
  </section>
</template>
