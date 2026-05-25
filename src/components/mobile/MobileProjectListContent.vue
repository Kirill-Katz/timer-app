<script setup lang="ts">
import { Play, Plus } from 'lucide-vue-next';
import type { TimeTrackerAppContext } from '../../composables/useTimeTrackerApp';
import VirtualScroller from '../VirtualScroller.vue';

defineProps<{
  app: TimeTrackerAppContext;
}>();
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-3">
    <button class="btn-primary inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl px-4 font-normal" type="button" @click="app.openProjectCreate()">
      <Plus :size="18" /> Add new project
    </button>
    <VirtualScroller class="max-h-[46vh] pb-8" :items="app.projects" :item-height="56" item-key="id" :overscan="8">
      <template #default="{ item: project }">
        <article
          class="project-swipe-row relative h-full rounded-lg bg-sage/15"
          :data-project-id="project.id"
          v-memo="[project.name, project.color, project.archived, app.projectTotalDurationMs(project.id)]"
          @scroll.passive="app.handleProjectSwipeScroll($event, project.id)"
        >
          <div class="project-swipe-track">
            <div class="project-swipe-card relative grid h-full grid-cols-[auto_1fr_auto] items-center gap-2 rounded-lg bg-panel px-3 py-2" @click="app.handleProjectCardClick(project.id)">
              <span class="h-3 w-3 rounded-full border border-black/10" :style="{ backgroundColor: project.color }"></span>
              <span class="truncate font-normal">{{ project.name }}</span>
              <button class="inline-flex h-8 w-28 shrink-0 items-center justify-center gap-1 rounded-full bg-stone-800/70 px-2.5 text-xs font-normal tabular-nums text-stone-400 active:scale-[0.99]" type="button" @click.stop="app.switchTimer(project.id)">
                <Play :size="14" fill="currentColor" /> {{ app.formatDurationMs(app.projectTotalDurationMs(project.id)) }}
              </button>
            </div>
            <div class="project-swipe-action">
              Tasks
            </div>
          </div>
        </article>
      </template>
    </VirtualScroller>
  </div>
</template>
