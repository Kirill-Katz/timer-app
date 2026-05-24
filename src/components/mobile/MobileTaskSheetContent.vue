<script setup lang="ts">
import { Play, Plus } from 'lucide-vue-next';
import type { TimeTrackerAppContext } from '../../composables/useTimeTrackerApp';
import VirtualScroller from '../VirtualScroller.vue';
import MobileBackButton from './MobileBackButton.vue';

defineProps<{
  app: TimeTrackerAppContext;
}>();
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-3">
    <div class="relative flex min-h-10 items-center justify-center">
      <MobileBackButton class="absolute left-0" aria-label="Back to projects" @click="app.taskSheetProjectId = null; app.taskCreateOpen = false" />
      <div class="mx-14 flex min-w-0 items-center justify-center gap-2">
        <span class="h-3 w-3 flex-none rounded-full border border-black/10" :style="{ backgroundColor: app.taskSheetProject?.color ?? '#777' }"></span>
        <h2 class="truncate text-center text-xl font-medium">{{ app.taskSheetProject?.name ?? 'Tasks' }}</h2>
      </div>
    </div>
    <div v-if="app.taskCreateOpen" class="grid shrink-0 gap-2">
      <input v-model="app.mobileTaskName" class="min-h-12 rounded-lg border border-line bg-panel px-3 text-ink placeholder:text-stone-500" placeholder="Task name" />
      <div class="grid grid-cols-2 gap-2">
        <button class="btn-secondary inline-flex min-h-11 items-center justify-center rounded-xl px-4 font-normal" type="button" @click="app.taskCreateOpen = false; app.mobileTaskName = ''">
          Cancel
        </button>
        <button class="btn-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 font-medium" type="button" @click="app.addMobileTask">
          <Plus :size="18" /> Add
        </button>
      </div>
    </div>
    <button v-else class="btn-primary inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl px-4 font-medium" type="button" @click="app.taskCreateOpen = true">
      <Plus :size="18" /> Add a new task
    </button>
    <VirtualScroller class="max-h-[40vh] pb-8" :items="app.taskSheetTasks" :item-height="64" item-key="id" :overscan="8">
      <template #default="{ item: task }">
        <article class="grid h-full grid-cols-[2.25rem_1fr_auto] items-start gap-1.5 rounded-lg bg-panel px-2.5 py-1.5" :class="[task.archived ? 'opacity-55' : '', task.completed ? 'opacity-70' : '']">
          <button
            class="relative inline-flex h-6 w-6 items-center justify-center rounded-full border-2 transition"
            :class="task.completed ? 'border-sage bg-sage text-ink' : 'border-stone-300 bg-transparent text-transparent'"
            type="button"
            :aria-label="task.completed ? 'Mark task incomplete' : 'Mark task complete'"
            @click="app.toggleTaskCompleted(task)"
          >
            <span v-if="task.completed" class="h-2.5 w-2.5 rounded-full bg-ink"></span>
          </button>
          <span class="min-w-0 whitespace-normal break-words text-sm font-normal leading-snug">{{ task.name }}</span>
          <button class="glass-start mt-0.5 inline-flex h-7 w-24 shrink-0 items-center justify-center gap-1 self-start rounded-full px-2 text-[11px] font-normal tabular-nums" type="button" @click="app.switchTimer(task.project_id, task.id)">
            <Play :size="14" fill="currentColor" /> {{ app.formatDurationMs(app.taskTotalDurationMs(task.id)) }}
          </button>
        </article>
      </template>
      <template #empty>
        <p class="py-8 text-center text-sm font-normal text-stone-300">No tasks yet.</p>
      </template>
    </VirtualScroller>
  </div>
</template>
