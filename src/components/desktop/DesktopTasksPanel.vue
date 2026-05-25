<script setup lang="ts">
import { Archive, ArchiveRestore, Circle, CircleDot, Plus } from 'lucide-vue-next';
import type { TimeTrackerAppContext } from '../../composables/useTimeTrackerApp';

defineProps<{
  app: TimeTrackerAppContext;
}>();
</script>

<template>
  <section class="rounded-lg border border-line bg-panel p-4 shadow-soft">
    <div class="mb-3 flex items-center justify-between gap-3">
      <h2 class="text-xl font-medium">Tasks</h2>
    </div>
    <form class="grid gap-2 sm:grid-cols-[1fr_auto]" @submit.prevent="app.addTask">
      <input v-model="app.taskForm.name" class="min-h-11 rounded-lg border border-line bg-panel px-3 text-ink placeholder:text-stone-500 disabled:opacity-50" placeholder="New task" :disabled="!app.selectedProjectId" />
      <button class="btn-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 font-normal disabled:opacity-50" type="submit" :disabled="!app.selectedProjectId">
        <Plus :size="18" /> Task
      </button>
    </form>
    <div class="mt-4 grid gap-2">
      <div
        v-for="task in app.tasks"
        :key="task.id"
        v-memo="[task.name, task.archived, task.completed]"
        class="grid grid-cols-[2.5rem_1fr_2.75rem] items-center gap-2 rounded-lg border border-line bg-panel p-2"
        :class="[task.archived ? 'opacity-55' : '', task.completed ? 'opacity-70' : '']"
      >
        <button
          class="inline-flex min-h-10 items-center justify-center rounded-lg border border-line bg-panel text-ink"
          type="button"
          :title="task.completed ? 'Mark incomplete' : 'Mark complete'"
          @click="app.toggleTaskCompleted(task)"
        >
          <CircleDot v-if="task.completed" :size="18" />
          <Circle v-else :size="18" />
        </button>
        <input
          v-model="task.name"
          class="min-h-10 rounded-md border border-transparent bg-panel px-2 text-ink"
          :class="task.completed ? 'line-through' : ''"
          @blur="app.saveTask(task)"
        />
        <button class="btn-primary inline-flex min-h-10 items-center justify-center rounded-lg" type="button" :title="task.archived ? 'Unarchive task' : 'Archive task'" @click="app.toggleTaskArchive(task)">
          <ArchiveRestore v-if="task.archived" :size="18" />
          <Archive v-else :size="18" />
        </button>
      </div>
    </div>
  </section>
</template>
