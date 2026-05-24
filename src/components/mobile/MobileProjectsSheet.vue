<script setup lang="ts">
import type { TimeTrackerAppContext } from '../../composables/useTimeTrackerApp';
import MobileBottomSheet from './MobileBottomSheet.vue';
import MobileProjectCreateForm from './MobileProjectCreateForm.vue';
import MobileProjectListContent from './MobileProjectListContent.vue';
import MobileTaskSheetContent from './MobileTaskSheetContent.vue';

defineProps<{
  app: TimeTrackerAppContext;
}>();
</script>

<template>
  <MobileBottomSheet :show="app.projectsSheetOpen" z-class="z-[80]" min-height-class="min-h-[62vh]" @close="app.closeSheets">
    <MobileTaskSheetContent v-if="app.taskSheetProjectId" :app="app" />
    <MobileProjectCreateForm v-else-if="app.projectCreateOpen" :app="app" />
    <MobileProjectListContent v-else :app="app" />
  </MobileBottomSheet>
</template>
