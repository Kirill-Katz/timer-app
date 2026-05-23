<script setup lang="ts">
import {
  ArrowLeft,
  Check,
  Circle,
  LogOut,
  Menu,
  Pencil,
  Play,
  Plus,
  Square,
  Trash2,
  Wifi,
  WifiOff
} from 'lucide-vue-next';
import type { TimeTrackerAppContext } from '../composables/useTimeTrackerApp';

defineProps<{
  app: TimeTrackerAppContext;
}>();
</script>

<template>
  <section class="sm:hidden">
    <section v-if="app.settingsOpen" class="min-h-[calc(100vh-7rem)] rounded-lg border border-line bg-panel p-4 shadow-soft">
      <div class="mb-4 flex items-center justify-between gap-3">
        <button class="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-transparent px-3 font-bold text-ink" type="button" @click="app.closeSettings">
          <ArrowLeft :size="18" /> Back
        </button>
      </div>
      <div class="mb-5">
        <h2 class="text-3xl font-black leading-none">Settings</h2>
      </div>
      <div class="grid gap-3">
        <div class="rounded-lg border border-line bg-panel p-3">
          <div class="flex items-center justify-between gap-3">
            <span class="font-bold">Connection</span>
            <span class="inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm font-extrabold" :class="app.syncState.online ? 'border-line bg-panel' : 'border-red-900/70 bg-red-950/70 text-red-100'">
              <Wifi v-if="app.syncState.online" :size="16" />
              <WifiOff v-else :size="16" />
              {{ app.syncState.online ? 'Online' : 'Offline' }}
            </span>
          </div>
        </div>
        <div class="rounded-lg border border-line bg-panel p-3">
          <div class="flex items-center justify-between gap-3">
            <span class="font-bold">Pending operations</span>
            <span class="inline-flex min-h-9 items-center gap-2 rounded-full border border-line bg-panel px-3 text-sm font-extrabold">
              <Circle :size="12" :fill="app.syncState.pendingCount ? '#c7792b' : '#4f8f6b'" />
              {{ app.syncState.pendingCount }}
            </span>
          </div>
        </div>
        <div class="rounded-lg border border-line bg-panel p-3">
          <div class="flex items-center justify-between gap-3">
            <span class="font-bold">Sync</span>
            <span class="rounded-full border border-line bg-panel px-3 py-2 text-sm font-extrabold">{{ app.syncState.syncing ? 'Syncing' : 'Idle' }}</span>
          </div>
          <p v-if="app.syncState.lastError" class="mt-3 rounded-lg bg-red-700 px-3 py-2 text-sm font-bold text-white">{{ app.syncState.lastError }}</p>
        </div>
        <button class="mt-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-red-700 px-4 font-black text-white" type="button" @click="app.signOut">
          <LogOut :size="18" /> Sign out
        </button>
      </div>
    </section>

    <section v-else-if="app.editingLogId" class="-mx-3 -my-4 flex h-[100dvh] flex-col overflow-hidden bg-paper px-4 py-5">
      <div class="relative mb-6 flex min-h-10 items-center justify-center">
        <button class="absolute left-0 inline-flex min-h-10 w-12 items-center justify-center rounded-lg border border-line bg-transparent font-bold text-ink" type="button" aria-label="Back" @click="app.goBackFromEditor">
          <ArrowLeft :size="18" />
        </button>
        <p class="mx-14 truncate text-center text-2xl font-black leading-none">
          {{ app.logs.find((log) => log.id === app.editingLogId) ? app.formatDuration(app.logs.find((log) => log.id === app.editingLogId)!.start_time, app.logs.find((log) => log.id === app.editingLogId)!.end_time) : '00:00:00' }}
        </p>
      </div>
      <form class="flex min-h-0 flex-1 flex-col gap-3 overflow-auto" @submit.prevent="app.saveLog">
        <div class="rounded-xl border border-line bg-panel">
          <button class="grid w-full gap-1 border-b border-line px-4 py-3 text-left" type="button" @click="app.openEditPicker('project')">
            <span class="text-xs font-black uppercase text-stone-400">Project</span>
            <span class="flex items-center gap-2">
              <span class="h-3 w-3 flex-none rounded-full border border-black/10" :style="{ backgroundColor: app.projectById(app.logForm.project_id)?.color ?? '#777' }"></span>
              <span class="truncate text-base font-black text-ink">{{ app.projectById(app.logForm.project_id)?.name ?? 'Select project' }}</span>
            </span>
          </button>
          <button class="grid w-full gap-1 px-4 py-3 text-left" type="button" @click="app.openEditPicker('task')">
            <span class="text-xs font-black uppercase text-stone-400">Task</span>
            <span class="truncate text-base font-black text-ink">{{ app.taskById(app.logForm.task_id || null)?.name ?? 'No task' }}</span>
          </button>
        </div>
        <label class="grid gap-1 text-sm font-bold text-stone-300">
          Date
          <input v-model="app.logForm.date" class="min-h-12 w-full rounded-lg border border-line bg-panel px-3 text-base font-normal text-ink" type="date" required />
        </label>
        <label class="grid gap-1 text-sm font-bold text-stone-300">
          Start
          <input v-model="app.logForm.start_time" class="min-h-12 w-full rounded-lg border border-line bg-panel px-3 text-base font-normal text-ink" type="time" step="1" required />
        </label>
        <label class="grid gap-1 text-sm font-bold text-stone-300">
          End
          <input v-model="app.logForm.end_time" class="min-h-12 w-full rounded-lg border border-line bg-panel px-3 text-base font-normal text-ink" type="time" step="1" />
        </label>
        <div class="mt-auto grid gap-2 rounded-lg border border-line bg-panel/95 p-2 shadow-soft backdrop-blur">
          <button class="btn-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-4 font-black" type="submit">
            <Check :size="18" /> Save changes
          </button>
          <button v-if="app.logs.find((log) => log.id === app.editingLogId)" class="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-red-700 px-4 font-black text-white" type="button" @click="app.deleteLog(app.logs.find((log) => log.id === app.editingLogId)!)">
            <Trash2 :size="18" /> Delete
          </button>
        </div>
      </form>
      <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0" enter-to-class="opacity-100" leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0">
        <div v-if="app.editPickerMode" class="fixed inset-0 z-50 bg-black/20" @click="app.closeEditPicker">
          <div class="absolute inset-x-0 bottom-0 rounded-t-3xl border border-line bg-panel p-4 shadow-soft" @click.stop>
            <div class="mx-auto mb-4 h-1 w-12 rounded-full bg-line"></div>
            <div class="mb-3 flex items-center justify-between">
              <h3 class="text-xl font-black">{{ app.editPickerMode === 'project' ? 'Project' : 'Task' }}</h3>
            </div>
            <div class="grid max-h-[50vh] gap-2 overflow-auto pb-4">
              <button v-if="app.editPickerMode === 'task'" class="inline-flex min-h-12 items-center justify-start rounded-xl bg-panel px-4 text-left font-black text-ink" type="button" @click="app.selectEditTask(null)">
                No task
              </button>
              <button v-for="option in app.editPickerMode === 'project' ? app.projects : app.logFormTasks" :key="option.id" class="inline-flex min-h-12 items-center justify-start gap-2 rounded-xl bg-panel px-4 text-left font-black text-ink" type="button" @click="app.editPickerMode === 'project' ? app.selectEditProject(option.id) : app.selectEditTask(option.id)">
                <span v-if="app.editPickerMode === 'project'" class="h-3 w-3 flex-none rounded-full border border-black/10" :style="{ backgroundColor: app.projectById(option.id)?.color ?? '#777' }"></span>
                <span>{{ option.name }}</span>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </section>

    <section v-else-if="app.detailGroup" class="-mx-3 -my-4 min-h-screen bg-paper px-4 py-5">
      <div class="relative mb-4 grid min-h-10 justify-items-center gap-1">
        <button class="absolute left-0 inline-flex min-h-10 w-12 items-center justify-center rounded-lg border border-line bg-transparent font-bold text-ink" type="button" aria-label="Back" @click="app.closeLogDetail">
          <ArrowLeft :size="18" />
        </button>
        <div class="mx-14 flex min-w-0 items-center justify-center gap-2">
          <span class="h-3 w-3 flex-none rounded-full border border-black/10" :style="{ backgroundColor: app.projectById(app.detailGroup.projectId)?.color ?? '#777' }"></span>
          <h2 class="truncate text-center text-xl font-black">{{ app.projectById(app.detailGroup.projectId)?.name ?? 'Unknown project' }}</h2>
        </div>
        <p v-if="app.taskById(app.detailGroup.taskId)" class="mx-14 truncate text-center text-sm font-bold text-stone-300">{{ app.taskById(app.detailGroup.taskId)?.name }}</p>
      </div>
      <div class="grid gap-2">
        <article v-for="log in app.detailLogs" :key="log.id" class="grid cursor-pointer grid-cols-1 border-b border-line px-1 py-2" @click="app.openLogEditor(log)">
          <div class="min-w-0">
            <p class="font-black">{{ app.formatTime(log.start_time) }} - {{ log.end_time ? app.formatTime(log.end_time) : 'Running' }}</p>
            <p class="text-xs font-semibold text-stone-300">{{ app.formatDuration(log.start_time, log.end_time) }}</p>
          </div>
        </article>
      </div>
    </section>

    <section v-else class="grid gap-6">
      <div v-if="app.runningLog" class="rounded-lg border border-sage/30 bg-sage/10 p-3">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="h-3 w-3 flex-none rounded-full border border-black/10" :style="{ backgroundColor: app.projectById(app.runningLog.project_id)?.color ?? '#777' }"></span>
              <p class="truncate font-black">{{ app.projectById(app.runningLog.project_id)?.name ?? 'Running' }}</p>
            </div>
            <p class="truncate text-sm font-bold text-stone-300">{{ app.taskById(app.runningLog.task_id)?.name ?? 'No task' }}</p>
          </div>
          <button class="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-red-700 px-4 font-black text-white" type="button" @click="app.endTimer">
            <Square :size="18" /> {{ app.formatDuration(app.runningLog.start_time, null) }}
          </button>
        </div>
      </div>
      <section v-for="group in app.groupedLogs" :key="group.label" class="grid gap-2">
        <div class="flex items-center justify-between gap-3 px-1">
          <h2 class="text-xl font-black">{{ group.label }}</h2>
          <span class="text-sm font-black text-stone-300">{{ app.formatDurationMs(group.totalMs) }}</span>
        </div>
        <article v-for="entry in group.entries" :key="`${group.label}-${entry.projectId}-${entry.taskId ?? 'none'}`" class="grid grid-cols-[1fr_auto] gap-3 border-b border-line px-1 py-2" @click="app.openLogDetail(app.dayKey(entry.latestStart), entry.projectId, entry.taskId)">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="h-3 w-3 flex-none rounded-full border border-black/10" :style="{ backgroundColor: app.projectById(entry.projectId)?.color ?? '#777' }"></span>
              <p class="truncate text-sm font-black">{{ app.projectById(entry.projectId)?.name ?? 'Unknown project' }}</p>
            </div>
            <p v-if="app.taskById(entry.taskId)" class="truncate text-xs font-semibold text-stone-300">{{ app.taskById(entry.taskId)?.name }}</p>
          </div>
          <button class="glass-start inline-flex h-8 w-28 shrink-0 items-center justify-center gap-1 rounded-full px-2.5 text-xs font-black tabular-nums" type="button" @click.stop="app.switchTimer(entry.projectId, entry.taskId)">
            <Play :size="14" fill="currentColor" /> {{ app.formatDurationMs(entry.totalMs) }}
          </button>
        </article>
      </section>
      <p v-if="!app.groupedLogs.length" class="px-1 py-10 text-center text-sm font-bold text-stone-300">No time logs yet.</p>
    </section>

    <nav v-if="!app.editingLogId" class="fixed inset-x-3 bottom-3 z-40 grid grid-cols-[3.5rem_1fr_3.5rem] items-center gap-2 rounded-2xl border border-line bg-panel/95 p-2 shadow-soft backdrop-blur">
      <button class="btn-primary inline-flex min-h-12 items-center justify-center rounded-xl" type="button" title="Menu" @click="app.openMenuSheet">
        <Menu :size="22" />
      </button>
      <button class="btn-primary inline-flex min-h-12 items-center justify-center rounded-xl px-4 font-black" type="button" @click="app.openProjectsSheet">
        Projects
      </button>
      <button class="min-h-12 rounded-xl bg-transparent" type="button" aria-hidden="true" tabindex="-1"></button>
    </nav>

    <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0" enter-to-class="opacity-100" leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0">
      <div v-if="app.menuSheetOpen" class="fixed inset-0 z-50 bg-black/20" @click="app.closeSheets">
        <div class="absolute inset-x-0 bottom-0 min-h-[50vh] rounded-t-3xl border border-line bg-panel p-4 shadow-soft transition duration-200 ease-out" @click.stop>
          <div class="mx-auto mb-4 h-1 w-12 rounded-full bg-line"></div>
          <div class="grid gap-2">
            <button class="btn-primary inline-flex min-h-12 items-center justify-start rounded-xl px-4 text-left font-black" type="button">Reports</button>
            <button class="btn-primary inline-flex min-h-12 items-center justify-start rounded-xl px-4 text-left font-black" type="button">Timers</button>
            <button class="btn-primary inline-flex min-h-12 items-center justify-start rounded-xl px-4 text-left font-black" type="button">Calendar</button>
            <button class="btn-primary inline-flex min-h-12 items-center justify-start rounded-xl px-4 text-left font-black" type="button" @click="app.closeSheets(); app.openSettings()">Settings</button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0" enter-to-class="opacity-100" leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0">
      <div v-if="app.projectsSheetOpen" class="fixed inset-0 z-50 bg-black/20" @click="app.closeSheets">
        <div class="absolute inset-x-0 bottom-0 min-h-[62vh] rounded-t-3xl border border-line bg-panel p-4 shadow-soft" @click.stop>
          <div class="mx-auto mb-4 h-1 w-12 rounded-full bg-line"></div>
          <div v-if="app.taskSheetProjectId" class="grid gap-3">
            <div class="relative flex min-h-10 items-center justify-center">
              <button class="absolute left-0 inline-flex min-h-10 w-12 items-center justify-center rounded-lg border border-line bg-transparent font-bold text-ink" type="button" aria-label="Back to projects" @click="app.taskSheetProjectId = null; app.taskCreateOpen = false">
                <ArrowLeft :size="18" />
              </button>
              <div class="mx-14 flex min-w-0 items-center justify-center gap-2">
                <span class="h-3 w-3 flex-none rounded-full border border-black/10" :style="{ backgroundColor: app.taskSheetProject?.color ?? '#777' }"></span>
                <h2 class="truncate text-center text-xl font-black">{{ app.taskSheetProject?.name ?? 'Tasks' }}</h2>
              </div>
            </div>
            <div v-if="app.taskCreateOpen" class="grid gap-2">
              <input v-model="app.mobileTaskName" class="min-h-12 rounded-lg border border-line bg-panel px-3 text-ink placeholder:text-stone-500" placeholder="Task name" />
              <div class="grid grid-cols-2 gap-2">
                <button class="inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-transparent px-4 font-bold text-ink" type="button" @click="app.taskCreateOpen = false; app.mobileTaskName = ''">
                  Cancel
                </button>
                <button class="btn-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 font-black" type="button" @click="app.addMobileTask">
                  <Plus :size="18" /> Add
                </button>
              </div>
            </div>
            <button v-else class="btn-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 font-black" type="button" @click="app.taskCreateOpen = true">
              <Plus :size="18" /> Add a new task
            </button>
            <div class="grid max-h-[40vh] gap-1.5 overflow-auto pb-8">
              <article v-for="task in app.taskSheetTasks" :key="task.id" class="grid grid-cols-[2.5rem_1fr_auto] items-center gap-2 rounded-lg bg-panel px-3 py-2" :class="[task.archived ? 'opacity-55' : '', task.completed ? 'opacity-70' : '']">
                <button
                  class="relative inline-flex h-6 w-6 items-center justify-center rounded-full border-2 transition"
                  :class="task.completed ? 'border-sage bg-sage text-ink' : 'border-stone-300 bg-transparent text-transparent'"
                  type="button"
                  :aria-label="task.completed ? 'Mark task incomplete' : 'Mark task complete'"
                  @click="app.toggleTaskCompleted(task)"
                >
                  <span v-if="task.completed" class="h-2.5 w-2.5 rounded-full bg-ink"></span>
                </button>
                <span class="truncate font-black">{{ task.name }}</span>
                <button class="glass-start inline-flex h-8 w-28 shrink-0 items-center justify-center gap-1 rounded-full px-2.5 text-xs font-black tabular-nums" type="button" @click="app.switchTimer(task.project_id, task.id)">
                  <Play :size="14" fill="currentColor" /> {{ app.formatDurationMs(app.taskTotalDurationMs(task.id)) }}
                </button>
              </article>
              <p v-if="!app.taskSheetTasks.length" class="py-8 text-center text-sm font-bold text-stone-300">No tasks yet.</p>
            </div>
          </div>
          <div v-else-if="app.projectCreateOpen" class="grid gap-3">
            <div class="flex items-center justify-between">
              <button class="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-line bg-transparent px-3 font-bold text-ink" type="button" @click="app.projectCreateOpen = false">
                <ArrowLeft :size="18" /> Back
              </button>
            </div>
            <h2 class="text-2xl font-black">New project</h2>
            <form class="grid gap-2" @submit.prevent="app.addMobileProject">
              <input v-model="app.projectForm.name" class="min-h-12 rounded-lg border border-line bg-panel px-3 text-ink placeholder:text-stone-500" placeholder="Project name" />
              <div class="grid grid-cols-[3.25rem_1fr] gap-2">
                <input v-model="app.projectForm.color" class="h-12 w-full rounded-lg border border-line bg-panel p-1" type="color" aria-label="Project color" />
                <button class="btn-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-4 font-black" type="submit">
                  <Plus :size="18" /> Add project
                </button>
              </div>
            </form>
          </div>
          <div v-else class="grid gap-3">
            <button class="btn-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 font-black" type="button" @click="app.openProjectCreate">
              <Plus :size="18" /> Add new project
            </button>
            <div class="grid max-h-[46vh] gap-1.5 overflow-auto pb-8">
              <article
                v-for="project in app.projects"
                :key="project.id"
                class="relative overflow-hidden rounded-lg bg-sage/15"
                :data-project-id="project.id"
                @touchstart.passive="app.handleProjectSwipeStart"
                @touchmove.passive="app.handleProjectSwipeMove($event, project.id)"
                @touchend="app.handleProjectSwipeEnd($event, project.id)"
              >
                <div class="absolute inset-y-0 right-0 flex w-24 items-center justify-center bg-sage/20 text-sm font-black text-ink backdrop-blur">
                  Tasks
                </div>
                <div class="relative grid touch-pan-y grid-cols-[auto_1fr_auto] items-center gap-2 rounded-lg bg-panel px-3 py-2 transition-transform duration-150 ease-out" :class="{ 'duration-0': app.swipingProjectId === project.id }" :style="app.projectSwipeStyle(project.id)">
                  <span class="h-3 w-3 rounded-full border border-black/10" :style="{ backgroundColor: project.color }"></span>
                  <span class="truncate font-black">{{ project.name }}</span>
                  <button class="glass-start inline-flex h-8 w-28 shrink-0 items-center justify-center gap-1 rounded-full px-2.5 text-xs font-black tabular-nums" type="button" @click.stop="app.switchTimer(project.id)">
                    <Play :size="14" fill="currentColor" /> {{ app.formatDurationMs(app.projectTotalDurationMs(project.id)) }}
                  </button>
                </div>
              </article>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </section>
</template>
