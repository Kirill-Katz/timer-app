<script setup lang="ts">
import { Check, Trash2 } from 'lucide-vue-next';
import type { TimeTrackerAppContext } from '../../composables/useTimeTrackerApp';
import MobileBackButton from './MobileBackButton.vue';
import MobileFormField from './MobileFormField.vue';
import MobileOverlay from './MobileOverlay.vue';

defineProps<{
  app: TimeTrackerAppContext;
}>();
</script>

<template>
  <MobileOverlay :show="Boolean(app.editingLogId)" z-class="z-[70]" content-class="flex flex-col px-4 py-5">
    <div class="relative mb-6 flex min-h-10 items-center justify-center">
      <MobileBackButton class="absolute left-0" @click="app.goBackFromEditor" />
      <p class="mx-14 truncate text-center text-2xl font-medium leading-none">
        {{ app.currentEditingLog ? app.formatDuration(app.currentEditingLog.start_time, app.currentEditingLog.end_time) : '00:00:00' }}
      </p>
    </div>
    <form class="flex min-h-0 flex-1 flex-col gap-3 overflow-auto" @submit.prevent="app.saveLog">
      <div class="rounded-xl border border-line bg-panel">
        <button class="grid w-full gap-1 border-b border-line px-4 py-3 text-left" type="button" @click="app.openEditPicker('project')">
          <span class="text-xs font-medium uppercase text-stone-400">Project</span>
          <span class="flex items-center gap-2">
            <span class="h-3 w-3 flex-none rounded-full border border-black/10" :style="{ backgroundColor: app.projectById(app.logForm.project_id)?.color ?? '#777' }"></span>
            <span class="truncate text-base font-medium text-ink">{{ app.projectById(app.logForm.project_id)?.name ?? 'Select project' }}</span>
          </span>
        </button>
        <button class="grid w-full gap-1 px-4 py-3 text-left" type="button" @click="app.openEditPicker('task')">
          <span class="text-xs font-medium uppercase text-stone-400">Task</span>
          <span class="truncate text-base font-medium text-ink">{{ app.taskById(app.logForm.task_id || null)?.name ?? 'No task' }}</span>
        </button>
      </div>
      <MobileFormField label="Date">
        <input v-model="app.logForm.date" class="min-h-12 w-full rounded-lg border border-line bg-panel px-3 text-base font-normal text-ink" type="date" required />
      </MobileFormField>
      <MobileFormField label="Start">
        <input v-model="app.logForm.start_time" class="min-h-12 w-full rounded-lg border border-line bg-panel px-3 text-base font-normal text-ink" type="time" step="1" required />
      </MobileFormField>
      <MobileFormField label="End">
        <div v-if="app.runningLog?.id === app.editingLogId" class="btn-secondary inline-flex min-h-12 items-center rounded-xl px-3 text-base font-normal text-stone-300">
          Tracking
        </div>
        <input v-else v-model="app.logForm.end_time" class="min-h-12 w-full rounded-xl border border-line bg-panel px-3 text-base font-normal text-ink" type="time" step="1" />
      </MobileFormField>
      <div class="mt-auto grid gap-2 rounded-lg border border-line bg-panel/95 p-2 shadow-soft backdrop-blur">
        <button class="btn-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 font-medium" type="submit">
          <Check :size="18" /> Save changes
        </button>
        <button v-if="app.currentEditingLog" class="btn-danger inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 font-medium" type="button" @click="app.deleteLog(app.currentEditingLog)">
          <Trash2 :size="18" /> Delete
        </button>
      </div>
    </form>
  </MobileOverlay>
</template>
