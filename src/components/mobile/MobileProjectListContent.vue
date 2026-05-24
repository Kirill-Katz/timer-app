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
          class="relative h-full overflow-hidden rounded-lg bg-sage/15"
          :data-project-id="project.id"
          @touchstart.passive="app.handleProjectSwipeStart"
          @touchmove.passive="app.handleProjectSwipeMove($event, project.id)"
          @touchend="app.handleProjectSwipeEnd($event, project.id)"
        >
          <div class="absolute inset-y-0 right-0 flex w-24 items-center justify-center bg-sage/20 text-sm font-normal text-ink backdrop-blur">
            Tasks
          </div>
          <div class="relative grid h-full touch-pan-y grid-cols-[auto_1fr_auto] items-center gap-2 rounded-lg bg-panel px-3 py-2 transition-transform duration-150 ease-out" :class="{ 'duration-0': app.swipingProjectId === project.id }" :style="app.projectSwipeStyle(project.id)" @click="app.openProjectLogDetail(project.id)">
            <span class="h-3 w-3 rounded-full border border-black/10" :style="{ backgroundColor: project.color }"></span>
            <span class="truncate font-normal">{{ project.name }}</span>
            <button class="glass-start inline-flex h-8 w-28 shrink-0 items-center justify-center gap-1 rounded-full px-2.5 text-xs font-normal tabular-nums" type="button" @click.stop="app.switchTimer(project.id)">
              <Play :size="14" fill="currentColor" /> {{ app.formatDurationMs(app.projectTotalDurationMs(project.id)) }}
            </button>
          </div>
        </article>
      </template>
    </VirtualScroller>
  </div>
</template>
