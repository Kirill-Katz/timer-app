<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { isElementNearBottom } from '../../composables/useNearBottomScroll';
import type { TimeTrackerAppContext } from '../../composables/useTimeTrackerApp';
import MobileBackButton from './MobileBackButton.vue';
import MobileLogRow from './MobileLogRow.vue';
import MobileOverlay from './MobileOverlay.vue';

const props = defineProps<{
  app: TimeTrackerAppContext;
}>();

const editingProjectName = ref(false);
const projectNameInput = ref<HTMLInputElement | null>(null);

async function startEditingProjectName() {
  editingProjectName.value = true;
  await nextTick();
  projectNameInput.value?.focus();
  projectNameInput.value?.select();
}

async function saveProjectName() {
  if (!props.app.projectLogDetailProject) return;
  editingProjectName.value = false;
  await props.app.saveProject(props.app.projectLogDetailProject);
}

function handleScroll(event: Event) {
  const target = event.target as HTMLElement | null;
  if (!target || props.app.loadingMoreProjectLogs || !props.app.hasMoreProjectLogs) return;
  if (isElementNearBottom(target)) {
    void props.app.loadMoreProjectLogs();
  }
}

watch(() => props.app.projectLogDetailProjectId, (projectId) => {
  if (!projectId) {
    editingProjectName.value = false;
  }
});
</script>

<template>
  <MobileOverlay :show="Boolean(app.projectLogDetailProjectId)" content-class="px-4 py-5" @scroll="handleScroll">
    <div v-if="app.projectLogDetailProject" class="relative mb-4 grid min-h-10 justify-items-center gap-1">
      <MobileBackButton class="absolute left-0" @click="app.closeProjectLogDetail" />
      <div class="mx-12 inline-flex max-w-[calc(100vw-6rem)] items-center justify-center gap-2">
        <label class="relative h-3 w-3 shrink-0 overflow-hidden rounded-full border border-black/10" :style="{ backgroundColor: app.projectLogDetailProject.color }" aria-label="Project color">
          <input
            v-model="app.projectLogDetailProject.color"
            class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            type="color"
            aria-label="Project color"
            @change="app.saveProject(app.projectLogDetailProject)"
          />
        </label>
        <input
          v-if="editingProjectName"
          ref="projectNameInput"
          v-model="app.projectLogDetailProject.name"
          class="min-w-0 flex-1 bg-transparent text-center text-xl font-medium text-ink outline-none"
          aria-label="Project name"
          @blur="saveProjectName"
          @keydown.enter.prevent="saveProjectName"
        />
        <button v-else class="inline-block min-w-0 max-w-full flex-none truncate text-center text-xl font-medium" type="button" @click="startEditingProjectName">
          {{ app.projectLogDetailProject.name }}
        </button>
      </div>
    </div>
    <div class="grid gap-2">
      <MobileLogRow
        v-for="log in app.projectLogDetailLogs"
        :key="log.id"
        :log="log"
        :time-label="`${app.formatTime(log.start_time)} - ${log.end_time ? app.formatTime(log.end_time) : 'Running'}`"
        :duration-label="app.formatDuration(log.start_time, log.end_time)"
        :meta-label="`${app.formatDateTime(log.start_time)} · ${app.taskById(log.task_id)?.name ?? 'No task'}`"
        @open="app.openLogEditor"
      />
      <p v-if="app.loadingMoreProjectLogs" class="px-1 py-4 text-center text-sm font-normal text-stone-300">Loading older logs...</p>
      <p v-else-if="!app.hasMoreProjectLogs && app.projectLogDetailLogs.length" class="px-1 py-4 text-center text-sm font-normal text-stone-500">Reached the end of project history.</p>
      <p v-if="!app.projectLogDetailLogs.length && !app.loadingMoreProjectLogs" class="px-1 py-10 text-center text-sm font-normal text-stone-300">No logs for this project yet.</p>
    </div>
  </MobileOverlay>
</template>
