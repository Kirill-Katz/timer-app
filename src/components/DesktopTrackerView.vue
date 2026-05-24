<script setup lang="ts">
import { Archive, ArchiveRestore, ArrowLeft, Check, Circle, CircleDot, Clock, LogOut, Pencil, Play, Plus, Settings, Square, Trash2, Wifi, WifiOff } from 'lucide-vue-next';
import type { TimeTrackerAppContext } from '../composables/useTimeTrackerApp';
import ReportsPanel from './ReportsPanel.vue';

defineProps<{
  app: TimeTrackerAppContext;
}>();
</script>

<template>
  <header class="mx-auto mb-3 hidden max-w-7xl justify-end gap-2 sm:flex">
    <button class="btn-primary inline-flex min-h-11 items-center justify-center rounded-lg px-4" type="button" @click="app.openReports">Reports</button>
    <button class="btn-primary inline-flex min-h-11 w-11 items-center justify-center rounded-lg" type="button" title="Settings" @click="app.openSettings">
      <Settings :size="20" />
    </button>
  </header>
  <section class="mx-auto hidden max-w-7xl gap-4 sm:grid lg:grid-cols-[19rem_1fr]">
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

    <section v-if="app.reportsOpen" class="grid gap-4">
      <section class="min-h-[calc(100vh-8rem)] rounded-lg border border-line bg-panel p-4 shadow-soft">
        <div class="mb-4 flex items-center justify-between gap-3">
          <button class="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-transparent px-3 font-normal text-ink" type="button" @click="app.closeReports">
            <ArrowLeft :size="18" /> Back
          </button>
        </div>
        <div class="mb-5">
          <h2 class="text-3xl font-medium leading-none">Reports</h2>
        </div>
        <ReportsPanel :app="app" />
      </section>
    </section>

    <section v-else-if="app.settingsOpen" class="grid gap-4">
      <section class="min-h-[calc(100vh-8rem)] rounded-lg border border-line bg-panel p-4 shadow-soft">
        <div class="mb-4 flex items-center justify-between gap-3">
          <button class="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-transparent px-3 font-normal text-ink" type="button" @click="app.closeSettings">
            <ArrowLeft :size="18" /> Back
          </button>
        </div>
        <div class="mb-5">
          <h2 class="text-3xl font-medium leading-none">Settings</h2>
        </div>
        <div class="grid gap-3">
          <div class="rounded-lg border border-line bg-panel p-3">
            <div class="flex items-center justify-between gap-3">
              <span class="font-normal">Connection</span>
              <span class="inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium" :class="app.syncState.online ? 'border-line bg-panel' : 'border-red-900/70 bg-red-950/70 text-red-100'">
                <Wifi v-if="app.syncState.online" :size="16" />
                <WifiOff v-else :size="16" />
                {{ app.syncState.online ? 'Online' : 'Offline' }}
              </span>
            </div>
          </div>
          <div class="rounded-lg border border-line bg-panel p-3">
            <div class="flex items-center justify-between gap-3">
              <span class="font-normal">Pending operations</span>
              <span class="inline-flex min-h-9 items-center gap-2 rounded-full border border-line bg-panel px-3 text-sm font-medium">
                <Circle :size="12" :fill="app.syncState.pendingCount ? '#c7792b' : '#4f8f6b'" />
                {{ app.syncState.pendingCount }}
              </span>
            </div>
          </div>
          <div class="rounded-lg border border-line bg-panel p-3">
            <div class="flex items-center justify-between gap-3">
              <span class="font-normal">Sync</span>
              <span class="rounded-full border border-line bg-panel px-3 py-2 text-sm font-medium">{{ app.syncState.syncing ? 'Syncing' : 'Idle' }}</span>
            </div>
            <p v-if="app.syncState.lastError" class="mt-3 rounded-lg bg-red-700 px-3 py-2 text-sm font-normal text-white">{{ app.syncState.lastError }}</p>
          </div>
          <button class="mt-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-red-700 px-4 font-medium text-white" type="button" @click="app.signOut">
            <LogOut :size="18" /> Sign out
          </button>
        </div>
      </section>
    </section>

    <section v-else-if="app.editingLogId" class="grid gap-4">
      <section class="flex h-[calc(100dvh-8rem)] flex-col overflow-hidden rounded-lg border border-line bg-panel p-4 shadow-soft">
        <div class="mb-4 flex items-center justify-between gap-3">
          <button class="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-transparent px-3 font-normal text-ink" type="button" @click="app.closeLogEditor">
            <ArrowLeft :size="18" /> Back
          </button>
        </div>
        <div class="mb-5">
          <p class="mb-1 text-xs font-medium uppercase text-rust">Time log</p>
          <h2 class="text-3xl font-medium leading-none">Edit entry</h2>
        </div>
        <form class="flex min-h-0 flex-1 flex-col gap-3 overflow-auto" @submit.prevent="app.saveLog">
          <label class="grid gap-1 text-sm font-normal text-stone-300">
            Project
            <select v-model="app.logForm.project_id" class="min-h-12 rounded-lg border border-line bg-panel px-3 text-base font-normal text-ink" required @change="app.handleLogProjectChange">
              <option value="" disabled>Project</option>
              <option v-for="project in app.projects" :key="project.id" :value="project.id">{{ project.name }}</option>
            </select>
          </label>
          <label class="grid gap-1 text-sm font-normal text-stone-300">
            Task
            <select v-model="app.logForm.task_id" class="min-h-12 rounded-lg border border-line bg-panel px-3 text-base font-normal text-ink">
              <option value="">No task</option>
              <option v-for="task in app.logFormTasks" :key="task.id" :value="task.id">{{ task.name }}</option>
            </select>
          </label>
          <label class="grid gap-1 text-sm font-normal text-stone-300">
            Date
            <input v-model="app.logForm.date" class="min-h-12 w-full rounded-lg border border-line bg-panel px-3 text-base font-normal text-ink" type="date" required />
          </label>
          <label class="grid gap-1 text-sm font-normal text-stone-300">
            Start
            <input v-model="app.logForm.start_time" class="min-h-12 w-full rounded-lg border border-line bg-panel px-3 text-base font-normal text-ink" type="time" step="1" required />
          </label>
          <label class="grid gap-1 text-sm font-normal text-stone-300">
            End
            <input v-model="app.logForm.end_time" class="min-h-12 w-full rounded-lg border border-line bg-panel px-3 text-base font-normal text-ink" type="time" step="1" />
          </label>
          <div class="mt-auto grid gap-2 rounded-lg border border-line bg-panel/95 p-2 shadow-soft backdrop-blur sm:grid-cols-2">
            <button class="btn-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-4 font-medium" type="submit">
              <Check :size="18" /> Save changes
            </button>
            <button v-if="app.currentEditingLog" class="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-red-700 px-4 font-medium text-white" type="button" @click="app.deleteLog(app.currentEditingLog)">
              <Trash2 :size="18" /> Delete
            </button>
          </div>
        </form>
      </section>
    </section>

    <section v-else class="grid gap-4 xl:grid-cols-2">
      <section class="rounded-lg border border-line bg-panel p-4 shadow-soft xl:col-span-2">
        <div class="mb-3 flex items-center justify-between gap-3">
          <h2 class="text-xl font-medium">Timer</h2>
        </div>
        <div v-if="app.selectedProject" class="mb-4 grid gap-2 rounded-lg border border-line bg-panel p-3 sm:grid-cols-[1fr_3.25rem_2.75rem]">
          <input v-model="app.selectedProject.name" class="min-h-11 rounded-lg border border-line bg-panel px-3 font-normal text-ink" @blur="app.saveSelectedProject" />
          <input v-model="app.selectedProject.color" class="h-11 w-full rounded-lg border border-line bg-panel p-1" type="color" aria-label="Selected project color" @change="app.saveSelectedProject" />
          <button class="btn-primary inline-flex min-h-11 items-center justify-center rounded-lg" type="button" :title="app.selectedProject.archived ? 'Unarchive project' : 'Archive project'" @click="app.toggleProjectArchive(app.selectedProject)">
            <ArchiveRestore v-if="app.selectedProject.archived" :size="18" />
            <Archive v-else :size="18" />
          </button>
        </div>
        <div class="flex min-h-32 items-center justify-center gap-3 rounded-lg border border-sage/30 bg-sage/10 text-ink">
          <Clock :size="24" />
          <strong class="text-[clamp(2.35rem,13vw,5.5rem)] font-medium leading-none">{{ app.runningLog ? app.formatDuration(app.runningLog.start_time, null) : '00:00:00' }}</strong>
        </div>
        <div class="sticky bottom-3 z-10 mt-4 grid gap-2 rounded-lg border border-line bg-panel/95 p-2 shadow-soft backdrop-blur sm:static sm:grid-cols-[1fr_auto] sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
          <select v-model="app.selectedTaskId" class="min-h-12 rounded-lg border border-line bg-panel px-3 text-ink">
            <option :value="null">No task</option>
            <option v-for="task in app.activeTasks" :key="task.id" :value="task.id">{{ task.name }}</option>
          </select>
          <button v-if="!app.runningLog" class="glass-start inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-5 font-normal disabled:opacity-50" type="button" :disabled="!app.canStartTimer" @click="app.beginTimer">
            <Play :size="18" /> Start
          </button>
          <button v-else class="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-red-700 px-5 font-medium text-white" type="button" @click="app.endTimer">
            <Square :size="18" /> Stop
          </button>
        </div>
      </section>
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
      <section class="rounded-lg border border-line bg-panel p-4 shadow-soft xl:col-span-2">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-xl font-medium">Time logs</h2>
        </div>
        <div class="grid gap-2">
          <article v-for="log in app.visibleLogs" :key="log.id" class="grid cursor-pointer grid-cols-[1fr_auto_auto] items-start gap-3 rounded-lg border border-line bg-panel p-3 transition hover:border-sage" tabindex="0" role="button" @click="app.openLogEditor(log)" @keydown.enter.prevent="app.openLogEditor(log)" @keydown.space.prevent="app.openLogEditor(log)">
            <div class="grid min-w-0 gap-1">
              <div class="flex items-center gap-2">
                <span class="h-3 w-3 flex-none rounded-full border border-black/10" :style="{ backgroundColor: app.projectById(log.project_id)?.color ?? '#777' }"></span>
                <strong class="truncate font-normal">{{ app.projectById(log.project_id)?.name ?? 'Unknown project' }}</strong>
              </div>
              <span class="text-sm text-stone-300">{{ app.taskById(log.task_id)?.name ?? 'No task' }} · {{ app.formatDateTime(log.start_time) }} · {{ app.formatDuration(log.start_time, log.end_time) }}</span>
            </div>
            <button class="btn-primary inline-flex min-h-10 w-10 items-center justify-center rounded-lg" type="button" title="Edit log" @click.stop="app.openLogEditor(log)">
              <Pencil :size="18" />
            </button>
            <button class="inline-flex min-h-10 w-10 items-center justify-center rounded-lg bg-red-700 text-white" type="button" title="Delete log" @click.stop="app.deleteLog(log)">
              <Trash2 :size="18" />
            </button>
          </article>
        </div>
      </section>
    </section>
  </section>
</template>
