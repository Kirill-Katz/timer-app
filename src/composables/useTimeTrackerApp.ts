import { computed, onMounted, onUnmounted, proxyRefs, reactive, ref } from 'vue';
import { supabase, getCurrentUserId, handleAuthRedirect } from '../services/supabase';
import { hydrateFromRemote, startBackgroundSync, subscribeSyncState, type SyncState } from '../services/sync-queue';
import { createProject, listProjects, setProjectArchived, updateProject } from '../stores/projects';
import { createTask, listTasks, listTasksForProject, setTaskArchived, updateTask } from '../stores/tasks';
import { getRunningLog, listTimeLogs, softDeleteTimeLog, startTimer, stopTimer, updateTimeLog } from '../stores/time-logs';
import type { Project, Task, TimeLog } from '../types';

export interface DetailGroup {
  day: string;
  projectId: string;
  taskId: string | null;
}

export function useTimeTrackerApp() {
  const userId = ref<string | null>(null);
  const email = ref('');
  const authMessage = ref('');
  const allowedEmail = (import.meta.env.VITE_ALLOWED_EMAIL ?? 'cat.chirill@gmail.com').toLowerCase();
  const projects = ref<Project[]>([]);
  const tasks = ref<Task[]>([]);
  const allTasks = ref<Task[]>([]);
  const logs = ref<TimeLog[]>([]);
  const selectedProjectId = ref('');
  const selectedTaskId = ref<string | null>(null);
  const includeArchived = ref(false);
  const runningLog = ref<TimeLog | undefined>();
  const editingLogId = ref<string | null>(null);
  const detailGroup = ref<DetailGroup | null>(null);
  const previousMobileScreen = ref<'main' | 'detail' | 'settings'>('main');
  const settingsOpen = ref(false);
  const menuSheetOpen = ref(false);
  const projectsSheetOpen = ref(false);
  const projectCreateOpen = ref(false);
  const taskSheetProjectId = ref<string | null>(null);
  const taskCreateOpen = ref(false);
  const mobileTaskName = ref('');
  const swipeStartX = ref(0);
  const swipeStartY = ref(0);
  const swipingProjectId = ref<string | null>(null);
  const swipeOffsetX = ref(0);
  const editPickerMode = ref<'project' | 'task' | null>(null);
  const ticker = ref(Date.now());
  const syncState = reactive<SyncState>({
    online: navigator.onLine,
    syncing: false,
    pendingCount: 0,
    lastError: null
  });

  const projectForm = reactive({ name: '', color: '#2e7d5b' });
  const taskForm = reactive({ name: '' });
  const logForm = reactive({
    id: '',
    project_id: '',
    task_id: '',
    date: '',
    start_time: '',
    end_time: ''
  });

  let stopSync: (() => void) | undefined;
  let unsubscribeSync: (() => void) | undefined;
  let unsubscribeAuth: (() => void) | undefined;
  let timerInterval: number | undefined;

  const selectedProject = computed(() => projects.value.find((project) => project.id === selectedProjectId.value));
  const taskSheetProject = computed(() => projects.value.find((project) => project.id === taskSheetProjectId.value));
  const taskSheetTasks = computed(() => allTasks.value.filter((task) => task.project_id === taskSheetProjectId.value && (includeArchived.value || !task.archived)));
  const activeTasks = computed(() => tasks.value.filter((task) => includeArchived.value || !task.archived));
  const logFormTasks = computed(() => allTasks.value.filter((task) => task.project_id === logForm.project_id && (includeArchived.value || !task.archived)));
  const visibleLogs = computed(() => logs.value.filter((log) => includeArchived.value || !projectById(log.project_id)?.archived));
  const canStartTimer = computed(() => Boolean(userId.value && selectedProjectId.value && !runningLog.value));
  const groupedLogs = computed(() => {
    const groups = new Map<string, { totalMs: number; entries: Map<string, { projectId: string; taskId: string | null; totalMs: number; latestStart: string }> }>();
    visibleLogs.value.forEach((log) => {
      const label = dayLabel(log.start_time);
      const group = groups.get(label) ?? { totalMs: 0, entries: new Map<string, { projectId: string; taskId: string | null; totalMs: number; latestStart: string }>() };
      const duration = logDurationMs(log);
      const key = `${log.project_id}:${log.task_id ?? 'none'}`;
      const entry = group.entries.get(key) ?? {
        projectId: log.project_id,
        taskId: log.task_id,
        totalMs: 0,
        latestStart: log.start_time
      };

      entry.totalMs += duration;
      if (new Date(log.start_time).getTime() > new Date(entry.latestStart).getTime()) {
        entry.latestStart = log.start_time;
      }
      group.totalMs += duration;
      group.entries.set(key, entry);
      groups.set(label, group);
    });
    return [...groups.entries()].map(([label, group]) => ({
      label,
      totalMs: group.totalMs,
      entries: [...group.entries.values()].sort((a, b) => new Date(b.latestStart).getTime() - new Date(a.latestStart).getTime())
    }));
  });
  const detailLogs = computed(() => {
    if (!detailGroup.value) return [];

    return visibleLogs.value
      .filter((log) => dayKey(log.start_time) === detailGroup.value?.day && log.project_id === detailGroup.value.projectId && log.task_id === detailGroup.value.taskId)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  });

  onMounted(async () => {
    unsubscribeSync = subscribeSyncState((state) => {
      Object.assign(syncState, state);
      void refreshLocalData();
    });

    timerInterval = window.setInterval(() => {
      ticker.value = Date.now();
    }, 1_000);

    try {
      await handleAuthRedirect();
    } catch (error) {
      authMessage.value = error instanceof Error ? error.message : String(error);
    }

    const currentUserId = await getCurrentUserId();
    if (currentUserId) {
      await enterUserScope(currentUserId);
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user.id ?? null;
      if (nextUserId) {
        void enterUserScope(nextUserId);
      } else {
        leaveUserScope();
      }
    });
    unsubscribeAuth = () => authListener.subscription.unsubscribe();
  });

  onUnmounted(() => {
    stopSync?.();
    unsubscribeSync?.();
    unsubscribeAuth?.();
    if (timerInterval) window.clearInterval(timerInterval);
  });

  async function enterUserScope(nextUserId: string) {
    userId.value = nextUserId;
    authMessage.value = '';
    stopSync?.();

    try {
      await hydrateFromRemote(nextUserId);
    } catch (error) {
      syncState.lastError = error instanceof Error ? error.message : String(error);
    }

    stopSync = startBackgroundSync(nextUserId);
    await refreshLocalData();
  }

  function leaveUserScope() {
    stopSync?.();
    stopSync = undefined;
    userId.value = null;
    projects.value = [];
    tasks.value = [];
    allTasks.value = [];
    logs.value = [];
    runningLog.value = undefined;
    selectedProjectId.value = '';
    selectedTaskId.value = null;
    syncState.pendingCount = 0;
    closeSheets();
  }

  async function signIn() {
    const requestedEmail = email.value.trim().toLowerCase();
    if (!requestedEmail) return;
    if (requestedEmail !== allowedEmail) {
      authMessage.value = 'This app is restricted to the configured owner email.';
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: requestedEmail,
      options: { emailRedirectTo: window.location.origin }
    });

    authMessage.value = error ? error.message : 'Check your email for the sign-in link.';
  }

  async function signOut() {
    await supabase.auth.signOut();
    leaveUserScope();
  }

  async function refreshLocalData() {
    if (!userId.value) return;

    projects.value = await listProjects(userId.value, includeArchived.value);
    if (!selectedProjectId.value || !projects.value.some((project) => project.id === selectedProjectId.value)) {
      selectedProjectId.value = projects.value[0]?.id ?? '';
    }

    tasks.value = selectedProjectId.value ? await listTasksForProject(userId.value, selectedProjectId.value, includeArchived.value) : [];
    allTasks.value = await listTasks(userId.value);
    if (selectedTaskId.value && !tasks.value.some((task) => task.id === selectedTaskId.value)) {
      selectedTaskId.value = null;
    }

    logs.value = await listTimeLogs(userId.value);
    runningLog.value = await getRunningLog(userId.value);
  }

  async function addProject() {
    if (!userId.value || !projectForm.name.trim()) return;
    const project = await createProject(userId.value, projectForm.name.trim(), projectForm.color);
    projectForm.name = '';
    selectedProjectId.value = project.id;
    await refreshLocalData();
  }

  async function addMobileProject() {
    if (!projectForm.name.trim()) return;
    await addProject();
    projectCreateOpen.value = false;
  }

  async function saveSelectedProject() {
    if (!userId.value || !selectedProject.value) return;
    await updateProject(userId.value, selectedProject.value, {
      name: selectedProject.value.name.trim(),
      color: selectedProject.value.color
    });
    await refreshLocalData();
  }

  async function toggleProjectArchive(project: Project) {
    if (!userId.value) return;
    await setProjectArchived(userId.value, project, !project.archived);
    await refreshLocalData();
  }

  async function addTask() {
    if (!userId.value || !selectedProjectId.value || !taskForm.name.trim()) return;
    await createTask(userId.value, selectedProjectId.value, taskForm.name.trim());
    taskForm.name = '';
    await refreshLocalData();
  }

  async function addMobileTask() {
    if (!userId.value || !taskSheetProjectId.value || !mobileTaskName.value.trim()) return;
    await createTask(userId.value, taskSheetProjectId.value, mobileTaskName.value.trim());
    mobileTaskName.value = '';
    taskCreateOpen.value = false;
    await refreshLocalData();
  }

  async function saveTask(task: Task) {
    if (!userId.value || !task.name.trim()) return;
    await updateTask(userId.value, task, task.name.trim());
    await refreshLocalData();
  }

  async function toggleTaskArchive(task: Task) {
    if (!userId.value) return;
    await setTaskArchived(userId.value, task, !task.archived);
    await refreshLocalData();
  }

  async function beginTimer() {
    if (!userId.value || !canStartTimer.value) return;
    await startTimer(userId.value, selectedProjectId.value, selectedTaskId.value);
    await refreshLocalData();
  }

  async function switchTimer(projectId: string, taskId: string | null = null) {
    if (!userId.value) return;
    if (runningLog.value) {
      await stopTimer(userId.value, runningLog.value);
    }
    selectedProjectId.value = projectId;
    selectedTaskId.value = taskId;
    await startTimer(userId.value, projectId, taskId);
    closeSheets();
    await refreshLocalData();
  }

  async function endTimer() {
    if (!userId.value || !runningLog.value) return;
    await stopTimer(userId.value, runningLog.value);
    await refreshLocalData();
  }

  async function saveLog() {
    if (!userId.value || !editingLogId.value || !logForm.project_id || !logForm.date || !logForm.start_time) return;

    const payload = {
      project_id: logForm.project_id,
      task_id: logForm.task_id || null,
      start_time: fromDateAndTimeLocal(logForm.date, logForm.start_time),
      end_time: logForm.end_time ? fromDateAndTimeLocal(logForm.date, logForm.end_time) : null
    };

    const existing = logs.value.find((log) => log.id === editingLogId.value);
    if (!existing) return;

    await updateTimeLog(userId.value, existing, payload);
    closeLogEditor();
    await refreshLocalData();
  }

  async function deleteLog(log: TimeLog) {
    if (!userId.value) return;
    await softDeleteTimeLog(userId.value, log);
    if (editingLogId.value === log.id) {
      closeLogEditor();
    }
    await refreshLocalData();
  }

  function openLogEditor(log: TimeLog) {
    previousMobileScreen.value = detailGroup.value ? 'detail' : settingsOpen.value ? 'settings' : 'main';
    settingsOpen.value = false;
    closeSheets();
    editingLogId.value = log.id;
    logForm.project_id = log.project_id;
    logForm.task_id = log.task_id ?? '';
    logForm.date = toDateLocal(log.start_time);
    logForm.start_time = toTimeLocal(log.start_time);
    logForm.end_time = log.end_time ? toTimeLocal(log.end_time) : '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeLogEditor() {
    editingLogId.value = null;
    logForm.project_id = '';
    logForm.task_id = '';
    logForm.date = '';
    logForm.start_time = '';
    logForm.end_time = '';
    editPickerMode.value = null;
    if (previousMobileScreen.value !== 'detail') {
      detailGroup.value = null;
    }
  }

  function openLogDetail(day: string, projectId: string, taskId: string | null) {
    closeLogEditor();
    settingsOpen.value = false;
    closeSheets();
    detailGroup.value = { day, projectId, taskId };
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeLogDetail() {
    detailGroup.value = null;
  }

  function openSettings() {
    closeLogEditor();
    closeLogDetail();
    closeSheets();
    previousMobileScreen.value = detailGroup.value ? 'detail' : 'main';
    settingsOpen.value = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeSettings() {
    settingsOpen.value = false;
  }

  function goBackFromEditor() {
    editingLogId.value = null;
    editPickerMode.value = null;
    if (previousMobileScreen.value !== 'detail') {
      detailGroup.value = null;
    }
  }

  function openEditPicker(mode: 'project' | 'task') {
    editPickerMode.value = mode;
  }

  function closeEditPicker() {
    editPickerMode.value = null;
  }

  function selectEditProject(projectId: string) {
    logForm.project_id = projectId;
    handleLogProjectChange();
    editPickerMode.value = null;
  }

  function selectEditTask(taskId: string | null) {
    logForm.task_id = taskId ?? '';
    editPickerMode.value = null;
  }

  function openMenuSheet() {
    closeLogEditor();
    settingsOpen.value = false;
    projectsSheetOpen.value = false;
    projectCreateOpen.value = false;
    menuSheetOpen.value = true;
  }

  function openProjectsSheet() {
    closeLogEditor();
    settingsOpen.value = false;
    menuSheetOpen.value = false;
    projectCreateOpen.value = false;
    taskSheetProjectId.value = null;
    taskCreateOpen.value = false;
    projectsSheetOpen.value = true;
  }

  function openProjectCreate() {
    projectCreateOpen.value = true;
  }

  function closeSheets() {
    menuSheetOpen.value = false;
    projectsSheetOpen.value = false;
    projectCreateOpen.value = false;
    taskSheetProjectId.value = null;
    taskCreateOpen.value = false;
    mobileTaskName.value = '';
  }

  function openProjectTasks(projectId: string) {
    taskSheetProjectId.value = projectId;
    projectCreateOpen.value = false;
    taskCreateOpen.value = false;
    mobileTaskName.value = '';
  }

  function handleProjectSwipeStart(event: TouchEvent) {
    swipeStartX.value = event.touches[0]?.clientX ?? 0;
    swipeStartY.value = event.touches[0]?.clientY ?? 0;
    swipingProjectId.value = (event.currentTarget as HTMLElement | null)?.dataset.projectId ?? null;
    swipeOffsetX.value = 0;
  }

  function handleProjectSwipeMove(event: TouchEvent, projectId: string) {
    const touch = event.touches[0];
    if (!touch || swipingProjectId.value !== projectId) return;

    const deltaX = touch.clientX - swipeStartX.value;
    const deltaY = touch.clientY - swipeStartY.value;
    if (deltaX < 0 && Math.abs(deltaY) < 45) {
      swipeOffsetX.value = Math.max(deltaX, -96);
    }
  }

  function handleProjectSwipeEnd(event: TouchEvent, projectId: string) {
    const touch = event.changedTouches[0];
    if (!touch) return;

    const deltaX = touch.clientX - swipeStartX.value;
    const deltaY = touch.clientY - swipeStartY.value;
    if (deltaX < -45 && Math.abs(deltaY) < 35) {
      openProjectTasks(projectId);
    }
    swipingProjectId.value = null;
    swipeOffsetX.value = 0;
  }

  function projectSwipeStyle(projectId: string) {
    if (swipingProjectId.value !== projectId) return {};
    return {
      transform: `translateX(${swipeOffsetX.value}px)`
    };
  }

  function handleLogProjectChange() {
    if (!logFormTasks.value.some((task) => task.id === logForm.task_id)) {
      logForm.task_id = '';
    }
  }

  function projectById(id: string) {
    return projects.value.find((project) => project.id === id);
  }

  function taskById(id: string | null) {
    if (!id) return undefined;
    return allTasks.value.find((task) => task.id === id) ?? tasks.value.find((task) => task.id === id);
  }

  function formatDuration(start: string, end: string | null) {
    return formatDurationMs(Math.max(0, (end ? new Date(end).getTime() : ticker.value) - new Date(start).getTime()));
  }

  function formatDurationMs(ms: number) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  function logDurationMs(log: TimeLog) {
    const endMs = log.end_time ? new Date(log.end_time).getTime() : ticker.value;
    return Math.max(0, endMs - new Date(log.start_time).getTime());
  }

  function formatDateTime(value: string) {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  }

  function dayLabel(value: string) {
    const date = new Date(value);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

    return new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  function dayKey(value: string) {
    return new Date(value).toISOString().slice(0, 10);
  }

  function formatTime(value: string) {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(new Date(value));
  }

  function toDateLocal(iso: string) {
    const date = new Date(iso);
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60_000);
    return local.toISOString().slice(0, 10);
  }

  function toTimeLocal(iso: string) {
    const date = new Date(iso);
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60_000);
    return local.toISOString().slice(11, 19);
  }

  function fromDateAndTimeLocal(date: string, time: string) {
    return new Date(`${date}T${time}`).toISOString();
  }

  return proxyRefs({
    userId,
    email,
    authMessage,
    projects,
    tasks,
    allTasks,
    logs,
    selectedProjectId,
    selectedTaskId,
    includeArchived,
    runningLog,
    editingLogId,
    detailGroup,
    settingsOpen,
    menuSheetOpen,
    projectsSheetOpen,
    projectCreateOpen,
    taskSheetProjectId,
    taskCreateOpen,
    mobileTaskName,
    swipingProjectId,
    editPickerMode,
    syncState,
    projectForm,
    taskForm,
    logForm,
    selectedProject,
    taskSheetProject,
    taskSheetTasks,
    activeTasks,
    logFormTasks,
    visibleLogs,
    canStartTimer,
    groupedLogs,
    detailLogs,
    signIn,
    signOut,
    refreshLocalData,
    addProject,
    addMobileProject,
    saveSelectedProject,
    toggleProjectArchive,
    addTask,
    addMobileTask,
    saveTask,
    toggleTaskArchive,
    beginTimer,
    switchTimer,
    endTimer,
    saveLog,
    deleteLog,
    openLogEditor,
    closeLogEditor,
    openLogDetail,
    closeLogDetail,
    openSettings,
    closeSettings,
    goBackFromEditor,
    openEditPicker,
    closeEditPicker,
    selectEditProject,
    selectEditTask,
    openMenuSheet,
    openProjectsSheet,
    openProjectCreate,
    closeSheets,
    handleProjectSwipeStart,
    handleProjectSwipeMove,
    handleProjectSwipeEnd,
    projectSwipeStyle,
    handleLogProjectChange,
    projectById,
    taskById,
    formatDuration,
    formatDurationMs,
    formatDateTime,
    dayKey,
    formatTime
  });
}

export type TimeTrackerAppContext = ReturnType<typeof useTimeTrackerApp>;
