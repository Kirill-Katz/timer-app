<script setup lang="ts">
import {
  Check,
  Circle,
  LogOut,
  Menu,
  Play,
  Plus,
  Square,
  Trash2,
  Wifi,
  WifiOff
} from 'lucide-vue-next';
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import VirtualScroller from './VirtualScroller.vue';
import MobileBackButton from './mobile/MobileBackButton.vue';
import MobileBottomSheet from './mobile/MobileBottomSheet.vue';
import MobileCenteredHeader from './mobile/MobileCenteredHeader.vue';
import MobileFormField from './mobile/MobileFormField.vue';
import MobileOverlay from './mobile/MobileOverlay.vue';
import MobileSettingsCard from './mobile/MobileSettingsCard.vue';
import ReportsPanel from './ReportsPanel.vue';
import type { TimeTrackerAppContext } from '../composables/useTimeTrackerApp';

const props = defineProps<{
  app: TimeTrackerAppContext;
}>();

const lastTimelineScrollTop = ref(0);
const editingProjectName = ref(false);
const projectNameInput = ref<HTMLInputElement | null>(null);

async function restoreTimelineScrollPosition() {
  await nextTick();
  requestAnimationFrame(() => {
    window.scrollTo({ top: props.app.timelineScrollTop, behavior: 'auto' });
    lastTimelineScrollTop.value = props.app.timelineScrollTop;
  });
}

function handleWindowScroll() {
  const nextScrollTop = window.scrollY;
  props.app.setTimelineScrollTop(nextScrollTop);

  const scrollingDown = nextScrollTop > lastTimelineScrollTop.value;
  lastTimelineScrollTop.value = nextScrollTop;
  if (!scrollingDown || !props.app.hasMoreLogs || props.app.loadingMoreLogs) return;

  const remaining = document.documentElement.scrollHeight - nextScrollTop - window.innerHeight;
  if (remaining <= 96) {
    void props.app.loadMoreLogs();
  }
}

function handleProjectLogScroll(event: Event) {
  const target = event.target as HTMLElement | null;
  if (!target || props.app.loadingMoreProjectLogs || !props.app.hasMoreProjectLogs) return;

  const remaining = target.scrollHeight - target.scrollTop - target.clientHeight;
  if (remaining <= 120) {
    void props.app.loadMoreProjectLogs();
  }
}

async function startEditingProjectName() {
  editingProjectName.value = true;
  await nextTick();
  projectNameInput.value?.focus();
  projectNameInput.value?.select();
}

async function saveProjectLogDetailProject() {
  if (!props.app.projectLogDetailProject) return;
  editingProjectName.value = false;
  await props.app.saveProject(props.app.projectLogDetailProject);
}

onMounted(() => {
  window.addEventListener('scroll', handleWindowScroll, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener('scroll', handleWindowScroll);
});

watch(
  () => [props.app.reportsOpen, props.app.settingsOpen, props.app.editingLogId, props.app.detailGroup?.day ?? null],
  async ([reportsOpen, settingsOpen, editingLogId, detailDay], [previousReportsOpen, previousSettingsOpen, previousEditingLogId, previousDetailDay]) => {
    const isMainTimeline = !reportsOpen && !settingsOpen && !editingLogId && !detailDay;
    const wasMainTimeline = !previousReportsOpen && !previousSettingsOpen && !previousEditingLogId && !previousDetailDay;
    if (!isMainTimeline || wasMainTimeline) return;
    await restoreTimelineScrollPosition();
  },
  { flush: 'post' }
);

watch(() => props.app.projectLogDetailProjectId, (projectId) => {
  if (!projectId) {
    editingProjectName.value = false;
  }
});
</script>

<template>
  <section class="relative sm:hidden">
    <section class="flex min-h-[calc(100vh-7rem)] flex-col gap-6 py-4">
      <header class="px-1">
        <h1 class="text-2xl font-medium leading-none text-ink">Timeline</h1>
      </header>
      <div v-if="app.runningLog" class="rounded-lg border border-sage/30 bg-sage/10 p-3">
        <div class="flex items-center justify-between gap-3">
          <button class="min-w-0 flex-1 text-left" type="button" @click="app.openLogEditor(app.runningLog)">
            <div class="flex items-center gap-2">
              <span class="h-3 w-3 flex-none rounded-full border border-black/10" :style="{ backgroundColor: app.projectById(app.runningLog.project_id)?.color ?? '#777' }"></span>
              <p class="truncate font-medium">{{ app.projectById(app.runningLog.project_id)?.name ?? 'Running' }}</p>
            </div>
            <p class="truncate text-sm font-normal text-stone-300">{{ app.taskById(app.runningLog.task_id)?.name ?? 'No task' }}</p>
          </button>
          <button class="btn-danger inline-flex h-11 w-32 items-center justify-center gap-2 rounded-xl px-4 font-medium tabular-nums" type="button" @click="app.endTimer">
            <Square :size="18" /> {{ app.formatDuration(app.runningLog.start_time, null) }}
          </button>
        </div>
      </div>
      <div class="min-h-0 flex-1 pb-24">
        <section v-for="group in app.groupedLogs" :key="group.label" class="mt-5 grid gap-2 first:mt-0">
          <div class="flex items-center justify-between gap-3 px-1">
            <h2 class="text-xl font-medium">{{ group.label }}</h2>
            <span class="text-sm font-normal text-stone-300">{{ app.formatDurationMs(group.totalMs) }}</span>
          </div>
          <article v-for="entry in group.entries" :key="`${group.label}-${entry.projectId}-${entry.taskId ?? 'none'}-${entry.latestStart}`" class="grid grid-cols-[1fr_auto] gap-3 border-b border-line px-1 py-2" @click="app.openLogDetail(app.dayKey(entry.latestStart), entry.projectId, entry.taskId)">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="h-3 w-3 flex-none rounded-full border border-black/10" :style="{ backgroundColor: app.projectById(entry.projectId)?.color ?? '#777' }"></span>
                <p class="truncate text-sm font-normal">{{ app.projectById(entry.projectId)?.name ?? 'Unknown project' }}</p>
              </div>
              <p v-if="app.taskById(entry.taskId)" class="truncate text-xs font-normal text-stone-300">{{ app.taskById(entry.taskId)?.name }}</p>
            </div>
            <button class="glass-start inline-flex h-8 w-28 shrink-0 items-center justify-center gap-1 rounded-full px-2.5 text-xs font-normal tabular-nums" type="button" @click.stop="app.switchTimer(entry.projectId, entry.taskId)">
              <Play :size="14" fill="currentColor" /> {{ app.formatDurationMs(entry.totalMs) }}
            </button>
          </article>
        </section>
        <p v-if="app.loadingMoreLogs" class="px-1 py-4 text-center text-sm font-normal text-stone-300">Loading older logs...</p>
        <p v-else-if="!app.hasMoreLogs && app.groupedLogs.length" class="px-1 py-4 text-center text-sm font-normal text-stone-500">Reached the end of loaded history.</p>
        <p v-if="!app.groupedLogs.length" class="px-1 py-10 text-center text-sm font-normal text-stone-300">No time logs yet.</p>
      </div>
    </section>

    <nav v-if="!app.editingLogId && !app.detailGroup && !app.projectLogDetailProjectId" class="fixed inset-x-0 bottom-0 z-[70] bg-panel/95 px-3 py-2 shadow-soft backdrop-blur">
      <div v-if="app.reportsOpen || app.settingsOpen" class="flex">
        <button class="inline-flex min-h-12 w-12 items-center justify-center rounded-xl border-0 bg-transparent text-ink" type="button" title="Menu" @click="app.openMenuSheet">
          <Menu :size="22" />
        </button>
      </div>
      <div v-else class="grid grid-cols-[3.5rem_1fr_3.5rem] items-center gap-2">
        <button class="inline-flex min-h-12 items-center justify-center rounded-xl border-0 bg-transparent text-ink" type="button" title="Menu" @click="app.openMenuSheet">
          <Menu :size="22" />
        </button>
        <button class="btn-primary inline-flex min-h-12 items-center justify-center rounded-xl px-4 font-normal" type="button" @click="app.openProjectsSheet">
          Projects
        </button>
        <button class="min-h-12 rounded-xl bg-transparent" type="button" aria-hidden="true" tabindex="-1"></button>
      </div>
    </nav>

    <MobileBottomSheet :show="app.menuSheetOpen" z-class="z-[80]" @close="app.closeSheets">
      <div class="grid gap-2">
        <button class="btn-primary inline-flex min-h-12 items-center justify-start rounded-xl px-4 text-left font-normal" type="button" @click="app.closeSheets(); app.openTimeline()">Timeline</button>
        <button class="btn-primary inline-flex min-h-12 items-center justify-start rounded-xl px-4 text-left font-normal" type="button" @click="app.closeSheets(); app.openReports()">Reports</button>
        <button class="btn-primary inline-flex min-h-12 items-center justify-start rounded-xl px-4 text-left font-normal" type="button">Timers</button>
        <button class="btn-primary inline-flex min-h-12 items-center justify-start rounded-xl px-4 text-left font-normal" type="button">Calendar</button>
        <button class="btn-primary inline-flex min-h-12 items-center justify-start rounded-xl px-4 text-left font-normal" type="button" @click="app.closeSheets(); app.openSettings()">Settings</button>
      </div>
    </MobileBottomSheet>

    <MobileBottomSheet :show="app.projectsSheetOpen" z-class="z-[80]" min-height-class="min-h-[62vh]" @close="app.closeSheets">
          <div v-if="app.taskSheetProjectId" class="flex min-h-0 flex-1 flex-col gap-3">
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
          <div v-else-if="app.projectCreateOpen" class="grid gap-3">
            <div class="flex min-h-10 items-center gap-2">
              <MobileBackButton class="shrink-0" compact aria-label="Back" @click="app.projectCreateOpen = false" />
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
          <div v-else class="flex min-h-0 flex-1 flex-col gap-3">
            <button class="btn-primary inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl px-4 font-normal" type="button" @click="app.openProjectCreate">
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
    </MobileBottomSheet>

    <MobileOverlay :show="app.reportsOpen" content-class="px-4 py-5 pb-24">
        <div class="mb-4">
          <h2 class="text-center text-xl font-medium">Reports</h2>
        </div>
        <ReportsPanel :app="app" />
    </MobileOverlay>

    <MobileOverlay :show="app.settingsOpen" content-class="px-4 py-5 pb-24">
        <div class="mb-4">
          <h2 class="text-center text-xl font-medium">Settings</h2>
        </div>
        <div class="grid gap-3">
          <MobileSettingsCard label="Connection">
            <template #value>
              <span class="inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm font-normal" :class="app.syncState.online ? 'border-line bg-panel' : 'border-red-900/70 bg-red-950/70 text-red-100'">
                <Wifi v-if="app.syncState.online" :size="16" />
                <WifiOff v-else :size="16" />
                {{ app.syncState.online ? 'Online' : 'Offline' }}
              </span>
            </template>
          </MobileSettingsCard>
          <MobileSettingsCard label="Pending operations">
            <template #value>
              <span class="inline-flex min-h-9 items-center gap-2 rounded-full border border-line bg-panel px-3 text-sm font-normal">
                <Circle :size="12" :fill="app.syncState.pendingCount ? '#c7792b' : '#4f8f6b'" />
                {{ app.syncState.pendingCount }}
              </span>
            </template>
          </MobileSettingsCard>
          <MobileSettingsCard label="Sync">
            <template #value>
              <span class="rounded-full border border-line bg-panel px-3 py-2 text-sm font-normal">{{ app.syncState.syncing ? 'Syncing' : 'Idle' }}</span>
            </template>
            <button class="btn-primary mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 font-normal" type="button" :disabled="!app.syncState.online" @click="app.synchronizeFromRemote">
              Synchronize
            </button>
            <p v-if="app.syncState.lastError" class="mt-3 rounded-lg bg-red-700 px-3 py-2 text-sm font-normal text-white">{{ app.syncState.lastError }}</p>
          </MobileSettingsCard>
          <button class="btn-danger mt-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 font-normal" type="button" @click="app.signOut">
            <LogOut :size="18" /> Sign out
          </button>
        </div>
    </MobileOverlay>

    <MobileOverlay :show="Boolean(app.detailGroup)">
        <MobileCenteredHeader
          v-if="app.detailGroup"
          class="mb-4"
          :title="app.projectById(app.detailGroup.projectId)?.name ?? 'Unknown project'"
          :subtitle="app.taskById(app.detailGroup.taskId)?.name ?? ''"
          :color="app.projectById(app.detailGroup.projectId)?.color ?? '#777'"
          @back="app.closeLogDetail"
        />
        <div class="grid gap-2">
          <article v-for="log in app.detailLogs" :key="log.id" class="grid cursor-pointer grid-cols-1 border-b border-line px-1 py-2" @click="app.openLogEditor(log)">
            <div class="min-w-0">
              <p class="font-medium">{{ app.formatTime(log.start_time) }} - {{ log.end_time ? app.formatTime(log.end_time) : 'Running' }}</p>
              <p class="text-xs font-normal text-stone-300">{{ app.formatDuration(log.start_time, log.end_time) }}</p>
            </div>
          </article>
        </div>
    </MobileOverlay>

    <MobileOverlay :show="Boolean(app.projectLogDetailProjectId)" content-class="px-4 py-5" @scroll.passive="handleProjectLogScroll">
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
              @blur="saveProjectLogDetailProject"
              @keydown.enter.prevent="saveProjectLogDetailProject"
            />
            <button v-else class="inline-block min-w-0 max-w-full flex-none truncate text-center text-xl font-medium" type="button" @click="startEditingProjectName">
              {{ app.projectLogDetailProject.name }}
            </button>
          </div>
        </div>
        <div class="grid gap-2">
          <article v-for="log in app.projectLogDetailLogs" :key="log.id" class="grid cursor-pointer grid-cols-1 border-b border-line px-1 py-2" @click="app.openLogEditor(log)">
            <div class="min-w-0">
              <p class="font-medium">{{ app.formatTime(log.start_time) }} - {{ log.end_time ? app.formatTime(log.end_time) : 'Running' }}</p>
              <p class="text-xs font-normal text-stone-300">
                {{ app.formatDateTime(log.start_time) }} · {{ app.taskById(log.task_id)?.name ?? 'No task' }} · {{ app.formatDuration(log.start_time, log.end_time) }}
              </p>
            </div>
          </article>
          <p v-if="app.loadingMoreProjectLogs" class="px-1 py-4 text-center text-sm font-normal text-stone-300">Loading older logs...</p>
          <p v-else-if="!app.hasMoreProjectLogs && app.projectLogDetailLogs.length" class="px-1 py-4 text-center text-sm font-normal text-stone-500">Reached the end of project history.</p>
          <p v-if="!app.projectLogDetailLogs.length && !app.loadingMoreProjectLogs" class="px-1 py-10 text-center text-sm font-normal text-stone-300">No logs for this project yet.</p>
        </div>
    </MobileOverlay>

    <MobileOverlay :show="Boolean(app.editingLogId)" z-class="z-[70]" content-class="flex flex-col px-4 py-5">
        <div class="relative mb-6 flex min-h-10 items-center justify-center">
          <MobileBackButton class="absolute left-0" @click="app.goBackFromEditor" />
          <p class="mx-14 truncate text-center text-2xl font-medium leading-none">
            {{ app.currentEditingLog ? app.formatDuration(app.currentEditingLog.start_time, app.currentEditingLog.end_time) : '00:00:00' }}
          </p>
        </div>
        <form class="flex min-h-0 flex-1 flex-col gap-3 overflow-auto" @submit.prevent="app.saveLog">
          <div class="rounded-xl border border-line bg-panel">
            <button class="grid w-full gap-1 border-b border-line px-4 py-3 text-left" type="button" @click="app.openEditPicker('project')">
              <span class="text-xs font-medium uppercase text-stone-400">Project</span>
              <span class="flex items-center gap-2">
                <span class="h-3 w-3 flex-none rounded-full border border-black/10" :style="{ backgroundColor: app.projectById(app.logForm.project_id)?.color ?? '#777' }"></span>
                <span class="truncate text-base font-medium text-ink">{{ app.projectById(app.logForm.project_id)?.name ?? 'Select project' }}</span>
              </span>
            </button>
            <button class="grid w-full gap-1 px-4 py-3 text-left" type="button" @click="app.openEditPicker('task')">
              <span class="text-xs font-medium uppercase text-stone-400">Task</span>
              <span class="truncate text-base font-medium text-ink">{{ app.taskById(app.logForm.task_id || null)?.name ?? 'No task' }}</span>
            </button>
          </div>
          <MobileFormField label="Date">
            <input v-model="app.logForm.date" class="min-h-12 w-full rounded-lg border border-line bg-panel px-3 text-base font-normal text-ink" type="date" required />
          </MobileFormField>
          <MobileFormField label="Start">
            <input v-model="app.logForm.start_time" class="min-h-12 w-full rounded-lg border border-line bg-panel px-3 text-base font-normal text-ink" type="time" step="1" required />
          </MobileFormField>
          <MobileFormField label="End">
            <div v-if="app.runningLog?.id === app.editingLogId" class="btn-secondary inline-flex min-h-12 items-center rounded-xl px-3 text-base font-normal text-stone-300">
              Tracking
            </div>
            <input v-else v-model="app.logForm.end_time" class="min-h-12 w-full rounded-xl border border-line bg-panel px-3 text-base font-normal text-ink" type="time" step="1" />
          </MobileFormField>
          <div class="mt-auto grid gap-2 rounded-lg border border-line bg-panel/95 p-2 shadow-soft backdrop-blur">
            <button class="btn-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 font-medium" type="submit">
              <Check :size="18" /> Save changes
            </button>
            <button v-if="app.currentEditingLog" class="btn-danger inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 font-medium" type="button" @click="app.deleteLog(app.currentEditingLog)">
              <Trash2 :size="18" /> Delete
            </button>
          </div>
        </form>
    </MobileOverlay>

    <MobileBottomSheet :show="Boolean(app.editPickerMode)" z-class="z-[80]" min-height-class="" @close="app.closeEditPicker">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="text-xl font-medium">{{ app.editPickerMode === 'project' ? 'Project' : 'Task' }}</h3>
          </div>
          <div class="grid max-h-[50vh] gap-2 overflow-auto pb-4">
            <button v-if="app.editPickerMode === 'task'" class="inline-flex min-h-12 items-center justify-start rounded-xl bg-panel px-4 text-left font-normal text-ink" type="button" @click="app.selectEditTask(null)">
              No task
            </button>
            <button v-for="option in app.editPickerMode === 'project' ? app.projects : app.logFormTasks" :key="option.id" class="inline-flex min-h-12 items-center justify-start gap-2 rounded-xl bg-panel px-4 text-left font-normal text-ink" type="button" @click="app.editPickerMode === 'project' ? app.selectEditProject(option.id) : app.selectEditTask(option.id)">
              <span v-if="app.editPickerMode === 'project'" class="h-3 w-3 flex-none rounded-full border border-black/10" :style="{ backgroundColor: app.projectById(option.id)?.color ?? '#777' }"></span>
              <span>{{ option.name }}</span>
            </button>
          </div>
    </MobileBottomSheet>
  </section>
</template>
