<script setup lang="ts">
import { Settings } from 'lucide-vue-next';
import type { TimeTrackerAppContext } from '../composables/useTimeTrackerApp';
import EmptyCalendarPanel from './EmptyCalendarPanel.vue';
import ReportsPanel from './ReportsPanel.vue';
import SettingsPanel from './SettingsPanel.vue';
import DesktopLogEditor from './desktop/DesktopLogEditor.vue';
import DesktopLogsPanel from './desktop/DesktopLogsPanel.vue';
import DesktopPagePanel from './desktop/DesktopPagePanel.vue';
import DesktopProjectSidebar from './desktop/DesktopProjectSidebar.vue';
import DesktopTasksPanel from './desktop/DesktopTasksPanel.vue';
import DesktopTimerPanel from './desktop/DesktopTimerPanel.vue';

defineProps<{
  app: TimeTrackerAppContext;
}>();
</script>

<template>
  <header class="mx-auto mb-3 hidden max-w-7xl justify-end gap-2 sm:flex">
    <button class="btn-primary inline-flex min-h-11 items-center justify-center rounded-lg px-4" type="button" @click="app.openCalendar">Calendar</button>
    <button class="btn-primary inline-flex min-h-11 items-center justify-center rounded-lg px-4" type="button" @click="app.openReports">Reports</button>
    <button class="btn-primary inline-flex min-h-11 w-11 items-center justify-center rounded-lg" type="button" title="Settings" @click="app.openSettings">
      <Settings :size="20" />
    </button>
  </header>
  <section class="mx-auto hidden max-w-7xl gap-4 sm:grid lg:grid-cols-[19rem_1fr]">
    <DesktopProjectSidebar :app="app" />

    <DesktopPagePanel v-if="app.calendarOpen" title="Calendar" @back="app.closeCalendar">
      <EmptyCalendarPanel />
    </DesktopPagePanel>

    <DesktopPagePanel v-else-if="app.reportsOpen" title="Reports" @back="app.closeReports">
      <ReportsPanel :app="app" />
    </DesktopPagePanel>

    <DesktopPagePanel v-else-if="app.settingsOpen" title="Settings" @back="app.closeSettings">
      <SettingsPanel :app="app" />
    </DesktopPagePanel>

    <DesktopLogEditor v-else-if="app.editingLogId" :app="app" />

    <section v-else class="grid gap-4 xl:grid-cols-2">
      <DesktopTimerPanel :app="app" />
      <DesktopTasksPanel :app="app" />
      <DesktopLogsPanel :app="app" />
    </section>
  </section>
</template>
