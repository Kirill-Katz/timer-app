<script setup lang="ts">
import { Plus } from 'lucide-vue-next';
import type { TimeTrackerAppContext } from '../../composables/useTimeTrackerApp';

defineProps<{
  app: TimeTrackerAppContext;
}>();
</script>

<template>
  <aside class="rounded-lg border border-line bg-panel p-4 shadow-soft">
    <div class="mb-3 flex items-center justify-between gap-3">
      <h2 class="text-xl font-medium">Projects</h2>
      <label class="inline-flex items-center gap-2 text-sm font-normal text-stone-300">
        <input v-model="app.includeArchived" class="h-4 w-4 accent-sage" type="checkbox" @change="app.refreshLocalData" />
        Archived
      </label>
    </div>
    <form class="grid gap-2" @submit.prevent="app.addProject">
      <input v-model="app.projectForm.name" class="min-h-11 rounded-lg border border-line bg-panel px-3 text-ink placeholder:text-stone-500" placeholder="Project name" />
      <div class="grid grid-cols-[3.25rem_1fr] gap-2">
        <input v-model="app.projectForm.color" class="h-11 w-full rounded-lg border border-line bg-panel p-1" type="color" aria-label="Project color" />
        <button class="btn-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 font-normal" type="submit">
          <Plus :size="18" /> Project
        </button>
      </div>
    </form>
    <div class="mt-4 grid max-h-64 gap-2 overflow-auto pr-1 lg:max-h-[calc(100vh-18rem)]">
      <button v-for="project in app.projects" :key="project.id" class="flex min-h-12 items-center gap-3 rounded-lg border bg-panel px-3 text-left font-normal text-ink" :class="[project.id === app.selectedProjectId ? 'border-sage shadow-[inset_3px_0_0_#7ef2bc]' : 'border-line', project.archived ? 'opacity-55' : '']" type="button" @click="app.selectedProjectId = project.id; app.refreshLocalData()">
        <span class="h-3 w-3 flex-none rounded-full border border-black/10" :style="{ backgroundColor: project.color }"></span>
        <span class="min-w-0 truncate">{{ project.name }}</span>
      </button>
    </div>
  </aside>
</template>
