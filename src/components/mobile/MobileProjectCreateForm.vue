<script setup lang="ts">
import { Plus } from 'lucide-vue-next';
import type { TimeTrackerAppContext } from '../../composables/useTimeTrackerApp';
import MobileBackButton from './MobileBackButton.vue';

defineProps<{
  app: TimeTrackerAppContext;
}>();
</script>

<template>
  <div class="grid gap-3">
    <div class="flex min-h-10 items-center gap-2">
      <MobileBackButton class="shrink-0" compact aria-label="Back" @click="app.closeProjectCreate" />
      <h2 class="truncate text-2xl font-medium">New project</h2>
    </div>
    <form class="grid gap-2" @submit.prevent="app.addMobileProject">
      <input v-model="app.projectForm.name" class="min-h-12 rounded-lg border border-line bg-panel px-3 text-ink placeholder:text-stone-500" placeholder="Project name" />
      <div class="grid grid-cols-[3.25rem_1fr] gap-2">
        <input v-model="app.projectForm.color" class="h-12 w-full rounded-lg border border-line bg-panel p-1" type="color" aria-label="Project color" />
        <button class="btn-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 font-medium" type="submit">
          <Plus :size="18" /> Add project
        </button>
      </div>
    </form>
  </div>
</template>
