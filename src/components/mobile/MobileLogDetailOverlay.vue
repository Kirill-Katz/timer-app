<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import type { TimeTrackerAppContext } from '../../composables/useTimeTrackerApp';
import MobileBackButton from './MobileBackButton.vue';
import MobileLogRow from './MobileLogRow.vue';
import MobileOverlay from './MobileOverlay.vue';

const props = defineProps<{
  app: TimeTrackerAppContext;
}>();

const editingProjectName = ref(false);
const projectNameInput = ref<HTMLInputElement | null>(null);

function detailProject() {
  if (!props.app.detailGroup) return undefined;
  return props.app.projectById(props.app.detailGroup.projectId);
}

async function startEditingProjectName() {
  editingProjectName.value = true;
  await nextTick();
  projectNameInput.value?.focus();
  projectNameInput.value?.select();
}

async function saveProjectName() {
  const project = detailProject();
  if (!project) return;
  editingProjectName.value = false;
  await props.app.saveProject(project);
}

watch(() => props.app.detailGroup?.projectId ?? null, (projectId) => {
  if (!projectId) {
    editingProjectName.value = false;
  }
});
</script>

<template>
  <MobileOverlay :show="Boolean(app.detailGroup)">
    <div v-if="app.detailGroup && detailProject()" class="relative mb-4 grid min-h-10 justify-items-center gap-1">
      <MobileBackButton class="absolute left-0" @click="app.closeLogDetail" />
      <div class="mx-12 grid w-[min(16.75rem,calc(100vw-6rem))] grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
        <label class="relative h-3 w-3 shrink-0 overflow-hidden rounded-full border border-black/10" :style="{ backgroundColor: detailProject()?.color ?? '#777' }" aria-label="Project color">
          <input
            v-model="detailProject()!.color"
            class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            type="color"
            aria-label="Project color"
            @change="app.saveProject(detailProject()!)"
          />
        </label>
        <input
          v-if="editingProjectName"
          ref="projectNameInput"
          v-model="detailProject()!.name"
          class="min-w-0 w-full bg-transparent text-center text-xl font-medium text-ink outline-none"
          aria-label="Project name"
          @blur="saveProjectName"
          @keydown.enter.prevent="saveProjectName"
        />
        <button v-else class="block min-w-0 w-full truncate text-center text-xl font-medium" type="button" @click="startEditingProjectName">
          {{ detailProject()?.name ?? 'Unknown project' }}
        </button>
      </div>
      <p v-if="app.taskById(app.detailGroup.taskId)?.name" class="mx-14 truncate text-center text-sm font-normal text-stone-300">
        {{ app.taskById(app.detailGroup.taskId)?.name }}
      </p>
    </div>
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
