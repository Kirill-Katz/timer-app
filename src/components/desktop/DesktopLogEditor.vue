<script setup lang="ts">
import { Check, Trash2 } from 'lucide-vue-next';
import type { TimeTrackerAppContext } from '../../composables/useTimeTrackerApp';
import DesktopPagePanel from './DesktopPagePanel.vue';

defineProps<{
  app: TimeTrackerAppContext;
}>();
</script>

<template>
  <DesktopPagePanel title="Edit entry" @back="app.closeLogEditor">
    <template #default>
      <p class="mb-1 text-xs font-medium uppercase text-rust">Time log</p>
      <form class="flex min-h-0 flex-1 flex-col gap-3 overflow-auto" @submit.prevent="app.saveLog">
        <label class="grid gap-1 text-sm font-normal text-stone-300">
          Project
          <select v-model="app.logForm.project_id" class="min-h-12 rounded-lg border border-line bg-panel px-3 text-base font-normal text-ink" required @change="app.handleLogProjectChange">
            <option value="" disabled>Project</option>
            <option v-for="project in app.projects" :key="project.id" :value="project.id">{{ project.name }}</option>
          </select>
        </label>
        <label class="grid gap-1 text-sm font-normal text-stone-300">
          Task
          <select v-model="app.logForm.task_id" class="min-h-12 rounded-lg border border-line bg-panel px-3 text-base font-normal text-ink">
            <option value="">No task</option>
            <option v-for="task in app.logFormTasks" :key="task.id" :value="task.id">{{ task.name }}</option>
          </select>
        </label>
        <label class="grid gap-1 text-sm font-normal text-stone-300">
          Date
          <input v-model="app.logForm.date" class="min-h-12 w-full rounded-lg border border-line bg-panel px-3 text-base font-normal text-ink" type="date" required />
        </label>
        <label class="grid gap-1 text-sm font-normal text-stone-300">
          Start
          <input v-model="app.logForm.start_time" class="min-h-12 w-full rounded-lg border border-line bg-panel px-3 text-base font-normal text-ink" type="time" step="1" required />
        </label>
        <label class="grid gap-1 text-sm font-normal text-stone-300">
          End
          <input v-model="app.logForm.end_time" class="min-h-12 w-full rounded-lg border border-line bg-panel px-3 text-base font-normal text-ink" type="time" step="1" />
        </label>
        <div class="mt-auto grid gap-2 rounded-lg border border-line bg-panel/95 p-2 shadow-soft backdrop-blur sm:grid-cols-2">
          <button class="btn-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-4 font-medium" type="submit">
            <Check :size="18" /> Save changes
          </button>
          <button v-if="app.currentEditingLog" class="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-red-700 px-4 font-medium text-white" type="button" @click="app.deleteLog(app.currentEditingLog)">
            <Trash2 :size="18" /> Delete
          </button>
        </div>
      </form>
    </template>
  </DesktopPagePanel>
</template>
