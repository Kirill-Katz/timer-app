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

const editingTaskName = ref(false);
const taskNameInput = ref<HTMLInputElement | null>(null);

async function startEditingTaskName() {
  editingTaskName.value = true;
  await nextTick();
  taskNameInput.value?.focus();
  taskNameInput.value?.select();
}

async function saveTaskName() {
  if (!props.app.taskLogDetailTask) return;
  editingTaskName.value = false;
  await props.app.saveTask(props.app.taskLogDetailTask);
}

function handleScroll(event: Event) {
  const target = event.target as HTMLElement | null;
  if (!target || props.app.loadingMoreTaskLogs || !props.app.hasMoreTaskLogs) return;
  if (isElementNearBottom(target)) {
    void props.app.loadMoreTaskLogs();
  }
}

watch(() => props.app.taskLogDetailTaskId, (taskId) => {
  if (!taskId) {
    editingTaskName.value = false;
  }
});
</script>

<template>
  <MobileOverlay :show="Boolean(app.taskLogDetailTaskId)" content-class="px-4 py-5" @scroll="handleScroll">
    <div v-if="app.taskLogDetailTask" class="relative mb-4 grid min-h-10 justify-items-center gap-1">
      <MobileBackButton class="absolute left-0" @click="app.closeTaskLogDetail" />
      <div class="mx-12 grid max-w-[calc(100vw-6rem)] justify-items-center gap-1">
        <div class="inline-flex min-w-0 items-center justify-center gap-2">
          <span class="h-3 w-3 shrink-0 rounded-full border border-black/10" :style="{ backgroundColor: app.taskLogDetailProject?.color ?? '#777' }"></span>
          <span class="truncate text-xs font-normal text-stone-400">{{ app.taskLogDetailProject?.name ?? 'Project' }}</span>
        </div>
        <input
          v-if="editingTaskName"
          ref="taskNameInput"
          v-model="app.taskLogDetailTask.name"
          class="min-w-0 bg-transparent text-center text-xl font-medium text-ink outline-none"
          aria-label="Task name"
          @blur="saveTaskName"
          @keydown.enter.prevent="saveTaskName"
        />
        <button v-else class="inline-block min-w-0 max-w-full truncate text-center text-xl font-medium" type="button" @click="startEditingTaskName">
          {{ app.taskLogDetailTask.name }}
        </button>
      </div>
    </div>
    <div class="grid gap-2">
      <MobileLogRow
        v-for="log in app.taskLogDetailLogs"
        :key="log.id"
        v-memo="[log.project_id, log.task_id, log.start_time, log.end_time, log.deleted_at, log.end_time ? 0 : app.ticker]"
        :log="log"
        :time-label="`${app.formatTime(log.start_time)} - ${log.end_time ? app.formatTime(log.end_time) : 'Running'}`"
        :duration-label="app.formatDuration(log.start_time, log.end_time)"
        :meta-label="app.formatDateTime(log.start_time)"
        @open="app.openLogEditor"
      />
      <p v-if="app.loadingMoreTaskLogs" class="px-1 py-4 text-center text-sm font-normal text-stone-300">Loading older logs...</p>
      <p v-else-if="!app.hasMoreTaskLogs && app.taskLogDetailLogs.length" class="px-1 py-4 text-center text-sm font-normal text-stone-500">Reached the end of task history.</p>
      <p v-if="!app.taskLogDetailLogs.length && !app.loadingMoreTaskLogs" class="px-1 py-10 text-center text-sm font-normal text-stone-300">No logs for this task yet.</p>
    </div>
  </MobileOverlay>
</template>
