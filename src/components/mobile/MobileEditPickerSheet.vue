<script setup lang="ts">
import type { TimeTrackerAppContext } from '../../composables/useTimeTrackerApp';
import MobileBottomSheet from './MobileBottomSheet.vue';

defineProps<{
  app: TimeTrackerAppContext;
}>();
</script>

<template>
  <MobileBottomSheet :show="Boolean(app.editPickerMode)" z-class="z-[80]" min-height-class="" @close="app.closeEditPicker">
    <div class="mb-3 flex items-center justify-between">
      <h3 class="text-xl font-medium">{{ app.editPickerMode === 'project' ? 'Project' : 'Task' }}</h3>
    </div>
    <div class="grid max-h-[50vh] gap-2 overflow-auto pb-4">
      <button v-if="app.editPickerMode === 'task'" class="inline-flex min-h-12 items-center justify-start rounded-xl bg-panel px-4 text-left font-normal text-ink" type="button" @click="app.selectEditTask(null)">
        No task
      </button>
      <button v-for="option in app.editPickerMode === 'project' ? app.projects : app.logFormTasks" :key="option.id" class="inline-flex min-h-12 items-center justify-start gap-2 rounded-xl bg-panel px-4 text-left font-normal text-ink" type="button" @click="app.editPickerMode === 'project' ? app.selectEditProject(option.id) : app.selectEditTask(option.id)">
        <span v-if="app.editPickerMode === 'project'" class="h-3 w-3 flex-none rounded-full border border-black/10" :style="{ backgroundColor: app.projectById(option.id)?.color ?? '#777' }"></span>
        <span>{{ option.name }}</span>
      </button>
    </div>
  </MobileBottomSheet>
</template>
