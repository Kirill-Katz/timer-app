import { computed, onMounted, onUnmounted, proxyRefs, reactive, ref } from 'vue';
import { supabase, getCurrentUserId, handleAuthRedirect } from '../services/supabase';
import { completedTimeLogDurationMs, timeLogDurationMs } from './useTimeLogDuration';
import { hasLogAggregates, rebuildLogAggregates } from '../services/log-aggregates';
import { ensureBootstrapData, reloadFromRemote, startBackgroundSync, subscribeSyncState, type SyncState } from '../services/sync-queue';
import { createProject, listProjects, setProjectArchived, updateProject } from '../stores/projects';
import { createTask, listTasks, listTasksForProject, setTaskArchived, setTaskCompleted, updateTask } from '../stores/tasks';
import { countProjectTimeLogs, countTimeLogs, getRunningLog, listProjectTimeLogsPage, listTimeLogs, listTimeLogsForGroup, listTimeLogsPage, softDeleteTimeLog, startTimer, stopTimer, sumProjectTimeLogDurations, sumTaskTimeLogDurations, updateTimeLog } from '../stores/time-logs';
import type { DetailGroup, GroupedLogSection, Project, Task, TimeLog } from '../types';
import { dayKey, formatDateTime, formatDuration as formatTimeLogDuration, formatDurationMs, formatTime, fromDateAndTimeLocal, toDateLocal, toTimeLocal } from './useDateTimeFormatters';
import { useProjectSwipeActions } from './useProjectSwipeActions';
import { buildGroupedLogs, sortLogsDesc, sortTasksByStatus, updateDurationTotal } from './useTimeTrackerDerivations';

type PreviousMobileScreen = 'main' | 'detail' | 'settings' | 'reports' | 'calendar';
type HistorySyncMode = 'push' | 'replace' | 'none';
type NavigationSnapshot = {
  previousMobileScreen: PreviousMobileScreen;
  reportsOpen: boolean;
  settingsOpen: boolean;
  calendarOpen: boolean;
  menuSheetOpen: boolean;
  projectsSheetOpen: boolean;
  projectCreateOpen: boolean;
  taskSheetProjectId: string | null;
  taskCreateOpen: boolean;
  editingLogId: string | null;
  detailGroup: DetailGroup | null;
  projectLogDetailProjectId: string | null;
  editPickerMode: 'project' | 'task' | null;
};
type AppHistoryState = {
  __timeTrackerNavigation: true;
  snapshot: NavigationSnapshot;
};

export function useTimeTrackerApp() {
  const INITIAL_MOBILE_TIMELINE_PAGE_SIZE = 80;
  const MOBILE_TIMELINE_PAGE_SIZE = 50;
  const APP_HISTORY_MARKER = '__timeTrackerNavigation';

  const userId = ref<string | null>(null);
  const email = ref('');
  const password = ref('');
  const authMessage = ref('');
  const projects = ref<Project[]>([]);
  const tasks = ref<Task[]>([]);
  const allTasks = ref<Task[]>([]);
  const logs = ref<TimeLog[]>([]);
  const reportLogs = ref<TimeLog[]>([]);
  const projectDurationTotals = ref<Record<string, number>>({});
  const taskDurationTotals = ref<Record<string, number>>({});
  const groupedLogs = ref<GroupedLogSection[]>([]);
  const detailLogs = ref<TimeLog[]>([]);
  const projectLogDetailProjectId = ref<string | null>(null);
  const projectLogDetailLogs = ref<TimeLog[]>([]);
  const selectedProjectId = ref('');
  const selectedTaskId = ref<string | null>(null);
  const includeArchived = ref(false);
  const runningLog = ref<TimeLog | undefined>();
  const editingLogId = ref<string | null>(null);
  const detailGroup = ref<DetailGroup | null>(null);
  const previousMobileScreen = ref<'main' | 'detail' | 'settings' | 'reports' | 'calendar'>('main');
  const reportsOpen = ref(false);
  const settingsOpen = ref(false);
  const calendarOpen = ref(false);
  const menuSheetOpen = ref(false);
  const projectsSheetOpen = ref(false);
  const projectCreateOpen = ref(false);
  const taskSheetProjectId = ref<string | null>(null);
  const taskCreateOpen = ref(false);
  const mobileTaskName = ref('');
  const editPickerMode = ref<'project' | 'task' | null>(null);
  const logOffset = ref(0);
  const totalLogCount = ref(0);
  const hasMoreLogs = ref(true);
  const loadingMoreLogs = ref(false);
  const projectLogOffset = ref(0);
  const totalProjectLogCount = ref(0);
  const hasMoreProjectLogs = ref(true);
  const loadingMoreProjectLogs = ref(false);
  const timelineScrollTop = ref(0);
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
  const handleOnlineRecovery = () => {
    if (!userId.value) return;
    void syncBootstrapData(userId.value, false);
  };

  const projectMap = computed(() => new Map(projects.value.map((project) => [project.id, project])));
  const taskMap = computed(() => {
    const nextMap = new Map<string, Task>();
    allTasks.value.forEach((task) => {
      nextMap.set(task.id, task);
    });
    tasks.value.forEach((task) => {
      if (!nextMap.has(task.id)) {
        nextMap.set(task.id, task);
      }
    });
    return nextMap;
  });
  const logMap = computed(() => new Map(logs.value.map((log) => [log.id, log])));
  const archivedProjectIds = computed(() => {
    const archived = new Set<string>();
    projectMap.value.forEach((project, projectId) => {
      if (project.archived) {
        archived.add(projectId);
      }
    });
    return archived;
  });

  const selectedProject = computed(() => projectMap.value.get(selectedProjectId.value));
  const taskSheetProject = computed(() => taskSheetProjectId.value ? projectMap.value.get(taskSheetProjectId.value) : undefined);
  const projectLogDetailProject = computed(() => projectLogDetailProjectId.value ? projectMap.value.get(projectLogDetailProjectId.value) : undefined);
  const taskSheetTasks = computed(() => sortTasksByStatus(allTasks.value.filter((task) => task.project_id === taskSheetProjectId.value && (includeArchived.value || !task.archived))));
  const activeTasks = computed(() => sortTasksByStatus(tasks.value.filter((task) => includeArchived.value || !task.archived)));
  const logFormTasks = computed(() => sortTasksByStatus(allTasks.value.filter((task) => task.project_id === logForm.project_id && (includeArchived.value || !task.archived))));
  const visibleLogs = computed(() => includeArchived.value
    ? logs.value
    : logs.value.filter((log) => !archivedProjectIds.value.has(log.project_id)));
  const canStartTimer = computed(() => Boolean(userId.value && selectedProjectId.value && !runningLog.value));
  const currentEditingLog = computed(() => editingLogId.value ? logMap.value.get(editingLogId.value) : undefined);
  let historyReady = false;
  let restoringHistory = false;
  let historyRestoreSequence = 0;

  function cloneDetailGroup(group: DetailGroup | null) {
    return group ? { ...group } : null;
  }

  function clearLogForm() {
    logForm.project_id = '';
    logForm.task_id = '';
    logForm.date = '';
    logForm.start_time = '';
    logForm.end_time = '';
  }

  function populateLogForm(log: TimeLog) {
    logForm.project_id = log.project_id;
    logForm.task_id = log.task_id ?? '';
    logForm.date = toDateLocal(log.start_time);
    logForm.start_time = toTimeLocal(log.start_time);
    logForm.end_time = log.end_time ? toTimeLocal(log.end_time) : '';
  }

  function resetProjectLogDetailState() {
    projectLogDetailProjectId.value = null;
    projectLogDetailLogs.value = [];
    projectLogOffset.value = 0;
    totalProjectLogCount.value = 0;
    hasMoreProjectLogs.value = true;
    loadingMoreProjectLogs.value = false;
  }

  function resetSheets() {
    menuSheetOpen.value = false;
    projectsSheetOpen.value = false;
    projectCreateOpen.value = false;
    taskSheetProjectId.value = null;
    taskCreateOpen.value = false;
    mobileTaskName.value = '';
  }

  function captureNavigationSnapshot(): NavigationSnapshot {
    return {
      previousMobileScreen: previousMobileScreen.value,
      reportsOpen: reportsOpen.value,
      settingsOpen: settingsOpen.value,
      calendarOpen: calendarOpen.value,
      menuSheetOpen: menuSheetOpen.value,
      projectsSheetOpen: projectsSheetOpen.value,
      projectCreateOpen: projectCreateOpen.value,
      taskSheetProjectId: taskSheetProjectId.value,
      taskCreateOpen: taskCreateOpen.value,
      editingLogId: editingLogId.value,
      detailGroup: cloneDetailGroup(detailGroup.value),
      projectLogDetailProjectId: projectLogDetailProjectId.value,
      editPickerMode: editPickerMode.value
    };
  }

  function normalizeNavigationSnapshot(snapshot: NavigationSnapshot): NavigationSnapshot {
    const normalized: NavigationSnapshot = {
      ...snapshot,
      detailGroup: cloneDetailGroup(snapshot.detailGroup)
    };

    if (!normalized.projectsSheetOpen) {
      normalized.projectCreateOpen = false;
      normalized.taskSheetProjectId = null;
      normalized.taskCreateOpen = false;
    }

    if (normalized.projectCreateOpen) {
      normalized.taskSheetProjectId = null;
      normalized.taskCreateOpen = false;
    }

    if (!normalized.taskSheetProjectId) {
      normalized.taskCreateOpen = false;
    }

    if (!normalized.editingLogId) {
      normalized.editPickerMode = null;
    }

    return normalized;
  }

  function navigationSnapshotsEqual(left: NavigationSnapshot, right: NavigationSnapshot) {
    return left.previousMobileScreen === right.previousMobileScreen
      && left.reportsOpen === right.reportsOpen
      && left.settingsOpen === right.settingsOpen
      && left.calendarOpen === right.calendarOpen
      && left.menuSheetOpen === right.menuSheetOpen
      && left.projectsSheetOpen === right.projectsSheetOpen
      && left.projectCreateOpen === right.projectCreateOpen
      && left.taskSheetProjectId === right.taskSheetProjectId
      && left.taskCreateOpen === right.taskCreateOpen
      && left.editingLogId === right.editingLogId
      && left.projectLogDetailProjectId === right.projectLogDetailProjectId
      && left.editPickerMode === right.editPickerMode
      && left.detailGroup?.day === right.detailGroup?.day
      && left.detailGroup?.projectId === right.detailGroup?.projectId
      && left.detailGroup?.taskId === right.detailGroup?.taskId;
  }

  function isAppHistoryState(state: unknown): state is AppHistoryState {
    return Boolean(
      state
      && typeof state === 'object'
      && APP_HISTORY_MARKER in state
      && (state as Record<string, unknown>)[APP_HISTORY_MARKER] === true
      && 'snapshot' in state
    );
  }

  function readHistorySnapshot() {
    if (!isAppHistoryState(window.history.state)) return null;
    return normalizeNavigationSnapshot(window.history.state.snapshot);
  }

  function writeHistorySnapshot(mode: HistorySyncMode, snapshot = captureNavigationSnapshot()) {
    if (!historyReady || restoringHistory || mode === 'none') return;

    const normalized = normalizeNavigationSnapshot(snapshot);
    const current = readHistorySnapshot();
    if (current && navigationSnapshotsEqual(current, normalized)) {
      if (mode === 'replace') {
        window.history.replaceState({ __timeTrackerNavigation: true, snapshot: normalized } satisfies AppHistoryState, document.title);
      }
      return;
    }

    const nextState = { __timeTrackerNavigation: true, snapshot: normalized } satisfies AppHistoryState;
    if (mode === 'push') {
      window.history.pushState(nextState, document.title);
      return;
    }

    window.history.replaceState(nextState, document.title);
  }

  function isBaseSnapshot(snapshot: NavigationSnapshot) {
    return !snapshot.reportsOpen
      && !snapshot.settingsOpen
      && !snapshot.calendarOpen
      && !snapshot.menuSheetOpen
      && !snapshot.projectsSheetOpen
      && !snapshot.projectCreateOpen
      && !snapshot.taskSheetProjectId
      && !snapshot.taskCreateOpen
      && !snapshot.editingLogId
      && !snapshot.detailGroup
      && !snapshot.projectLogDetailProjectId
      && !snapshot.editPickerMode;
  }

  function navigateBackOr(fallback: () => void) {
    const current = readHistorySnapshot();
    if (current && !isBaseSnapshot(current)) {
      window.history.back();
      return;
    }

    fallback();
  }

  function navigateHistoryDelta(delta: number, fallback: () => void) {
    if (delta <= 0) {
      fallback();
      return;
    }

    const current = readHistorySnapshot();
    if (current) {
      window.history.go(-delta);
      return;
    }

    fallback();
  }

  function currentSheetHistoryDepth() {
    if (taskCreateOpen.value) return 3;
    if (taskSheetProjectId.value) return 2;
    if (projectCreateOpen.value) return 2;
    if (projectsSheetOpen.value || menuSheetOpen.value) return 1;
    return 0;
  }

  function applyNavigationSnapshot(snapshot: NavigationSnapshot) {
    const normalized = normalizeNavigationSnapshot(snapshot);

    previousMobileScreen.value = normalized.previousMobileScreen;
    reportsOpen.value = normalized.reportsOpen;
    settingsOpen.value = normalized.settingsOpen;
    calendarOpen.value = normalized.calendarOpen;
    menuSheetOpen.value = normalized.menuSheetOpen;
    projectsSheetOpen.value = normalized.projectsSheetOpen;
    projectCreateOpen.value = normalized.projectCreateOpen;
    taskSheetProjectId.value = normalized.taskSheetProjectId;
    taskCreateOpen.value = normalized.taskCreateOpen;
    editingLogId.value = normalized.editingLogId;
    detailGroup.value = cloneDetailGroup(normalized.detailGroup);
    projectLogDetailProjectId.value = normalized.projectLogDetailProjectId;
    editPickerMode.value = normalized.editPickerMode;

    if (editingLogId.value) {
      const log = logs.value.find((entry) => entry.id === editingLogId.value);
      if (log) {
        populateLogForm(log);
      } else {
        editingLogId.value = null;
        editPickerMode.value = null;
        clearLogForm();
      }
    } else {
      clearLogForm();
    }

    if (!detailGroup.value) {
      detailLogs.value = [];
    } else {
      detailLogs.value = [];
    }

    if (!projectLogDetailProjectId.value) {
      resetProjectLogDetailState();
    } else {
      projectLogDetailLogs.value = [];
      projectLogOffset.value = 0;
      totalProjectLogCount.value = 0;
      hasMoreProjectLogs.value = true;
      loadingMoreProjectLogs.value = false;
    }

    if (!taskCreateOpen.value) {
      mobileTaskName.value = '';
    }
  }

  async function restoreNavigationSnapshot(snapshot: NavigationSnapshot) {
    const normalized = normalizeNavigationSnapshot(snapshot);
    const restoreSequence = ++historyRestoreSequence;

    restoringHistory = true;
    try {
      applyNavigationSnapshot(normalized);
    } finally {
      restoringHistory = false;
    }

    if (normalized.detailGroup && userId.value) {
      const nextDetailLogs = await listTimeLogsForGroup(userId.value, normalized.detailGroup.day, normalized.detailGroup.projectId, normalized.detailGroup.taskId);
      if (
        restoreSequence === historyRestoreSequence
        && detailGroup.value?.day === normalized.detailGroup.day
        && detailGroup.value?.projectId === normalized.detailGroup.projectId
        && detailGroup.value?.taskId === normalized.detailGroup.taskId
      ) {
        detailLogs.value = nextDetailLogs;
      }
    }

    if (normalized.projectLogDetailProjectId && userId.value && restoreSequence === historyRestoreSequence && projectLogDetailProjectId.value === normalized.projectLogDetailProjectId) {
      await loadInitialProjectLogs(normalized.projectLogDetailProjectId);
    }
  }

  function handlePopState(event: PopStateEvent) {
    if (!isAppHistoryState(event.state)) return;
    void restoreNavigationSnapshot(event.state.snapshot);
  }

  function updateProjectDurationTotal(projectId: string, deltaMs: number) {
    projectDurationTotals.value = updateDurationTotal(projectDurationTotals.value, projectId, deltaMs);
  }

  function updateTaskDurationTotal(taskId: string | null, deltaMs: number) {
    taskDurationTotals.value = updateDurationTotal(taskDurationTotals.value, taskId, deltaMs);
  }

  function applyLogDurationMutation(previous: TimeLog | null | undefined, next: TimeLog | null | undefined) {
    const previousDuration = completedTimeLogDurationMs(previous);
    const nextDuration = completedTimeLogDurationMs(next);

    if (previous) {
      updateProjectDurationTotal(previous.project_id, -previousDuration);
      updateTaskDurationTotal(previous.task_id, -previousDuration);
    }

    if (next) {
      updateProjectDurationTotal(next.project_id, nextDuration);
      updateTaskDurationTotal(next.task_id, nextDuration);
    }
  }

  function rebuildDerivedLogState() {
    groupedLogs.value = buildGroupedLogs(visibleLogs.value, logDurationMs);
  }

  function applyLogStateMutation(previous: TimeLog | null | undefined, next: TimeLog | null | undefined) {
    const previousCounted = Boolean(previous && !previous.deleted_at);
    const nextCounted = Boolean(next && !next.deleted_at);
    if (!previousCounted && nextCounted) {
      totalLogCount.value += 1;
    } else if (previousCounted && !nextCounted) {
      totalLogCount.value = Math.max(0, totalLogCount.value - 1);
    }

    const nextLogs = logs.value.filter((log) => log.id !== previous?.id && log.id !== next?.id);
    if (next && !next.deleted_at) {
      nextLogs.push(next);
    }
    logs.value = sortLogsDesc(nextLogs);

    const nextReportLogs = reportLogs.value.filter((log) => log.id !== previous?.id && log.id !== next?.id);
    if (next && !next.deleted_at) {
      nextReportLogs.push(next);
    }
    reportLogs.value = sortLogsDesc(nextReportLogs);

    applyLogDurationMutation(previous, next);

    if (next && !next.deleted_at && !next.end_time) {
      runningLog.value = next;
    } else if (previous?.id && runningLog.value?.id === previous.id) {
      runningLog.value = next && !next.deleted_at && !next.end_time ? next : undefined;
    }

    rebuildDerivedLogState();

    if (detailGroup.value) {
      const matchesDetail = (log: TimeLog | null | undefined) => {
        if (!log) return false;
        return dayKey(log.start_time) === detailGroup.value?.day
          && log.project_id === detailGroup.value?.projectId
          && log.task_id === detailGroup.value?.taskId;
      };

      const nextDetailLogs = detailLogs.value.filter((log) => log.id !== previous?.id && log.id !== next?.id);
      if (next && !next.deleted_at && matchesDetail(next)) {
        nextDetailLogs.push(next);
      }
      detailLogs.value = nextDetailLogs.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    }

    if (projectLogDetailProjectId.value) {
      const previousMatchesProject = Boolean(previous && !previous.deleted_at && previous.project_id === projectLogDetailProjectId.value);
      const nextMatchesProject = Boolean(next && !next.deleted_at && next.project_id === projectLogDetailProjectId.value);
      if (!previousMatchesProject && nextMatchesProject) {
        totalProjectLogCount.value += 1;
      } else if (previousMatchesProject && !nextMatchesProject) {
        totalProjectLogCount.value = Math.max(0, totalProjectLogCount.value - 1);
      }

      const nextProjectLogs = projectLogDetailLogs.value.filter((log) => log.id !== previous?.id && log.id !== next?.id);
      if (next && nextMatchesProject) {
        nextProjectLogs.push(next);
      }
      projectLogDetailLogs.value = sortLogsDesc(nextProjectLogs);
      projectLogOffset.value = projectLogDetailLogs.value.length;
      hasMoreProjectLogs.value = projectLogOffset.value < totalProjectLogCount.value;
    }
  }

  async function loadInitialLogs() {
    if (!userId.value) return;

    logOffset.value = 0;
    hasMoreLogs.value = true;
    loadingMoreLogs.value = false;

    const page = await listTimeLogsPage(userId.value, 0, INITIAL_MOBILE_TIMELINE_PAGE_SIZE);
    logs.value = page;
    logOffset.value = page.length;
    hasMoreLogs.value = logOffset.value < totalLogCount.value;
    rebuildDerivedLogState();
  }

  async function loadMoreLogs() {
    if (!userId.value || loadingMoreLogs.value || !hasMoreLogs.value) return;

    loadingMoreLogs.value = true;
    try {
      const page = await listTimeLogsPage(userId.value, logOffset.value, MOBILE_TIMELINE_PAGE_SIZE);
      if (!page.length) {
        hasMoreLogs.value = false;
        return;
      }

      const nextLogs = logs.value.slice();
      nextLogs.push(...page);
      logs.value = sortLogsDesc(nextLogs);
      logOffset.value += page.length;
      hasMoreLogs.value = logOffset.value < totalLogCount.value;
      rebuildDerivedLogState();
    } finally {
      loadingMoreLogs.value = false;
    }
  }

  async function loadInitialProjectLogs(projectId: string) {
    if (!userId.value) return;

    projectLogOffset.value = 0;
    hasMoreProjectLogs.value = true;
    loadingMoreProjectLogs.value = false;
    totalProjectLogCount.value = await countProjectTimeLogs(userId.value, projectId);

    const page = await listProjectTimeLogsPage(userId.value, projectId, 0, MOBILE_TIMELINE_PAGE_SIZE);
    projectLogDetailLogs.value = page;
    projectLogOffset.value = page.length;
    hasMoreProjectLogs.value = projectLogOffset.value < totalProjectLogCount.value;
  }

  async function loadMoreProjectLogs() {
    if (!userId.value || !projectLogDetailProjectId.value || loadingMoreProjectLogs.value || !hasMoreProjectLogs.value) return;

    loadingMoreProjectLogs.value = true;
    try {
      const page = await listProjectTimeLogsPage(userId.value, projectLogDetailProjectId.value, projectLogOffset.value, MOBILE_TIMELINE_PAGE_SIZE);
      if (!page.length) {
        hasMoreProjectLogs.value = false;
        return;
      }

      const nextLogs = projectLogDetailLogs.value.slice();
      nextLogs.push(...page);
      projectLogDetailLogs.value = sortLogsDesc(nextLogs);
      projectLogOffset.value += page.length;
      hasMoreProjectLogs.value = projectLogOffset.value < totalProjectLogCount.value;
    } finally {
      loadingMoreProjectLogs.value = false;
    }
  }

  function setTimelineScrollTop(nextScrollTop: number) {
    timelineScrollTop.value = Math.max(0, nextScrollTop);
  }

  onMounted(async () => {
    historyReady = true;
    window.history.replaceState({ __timeTrackerNavigation: true, snapshot: captureNavigationSnapshot() } satisfies AppHistoryState, document.title);
    window.addEventListener('popstate', handlePopState);

    unsubscribeSync = subscribeSyncState((state) => {
      Object.assign(syncState, state);
      void refreshLocalData();
    });

    window.addEventListener('online', handleOnlineRecovery);

    timerInterval = window.setInterval(() => {
      ticker.value = Date.now();
    }, 1_000);

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user.id ?? null;
      if (nextUserId) {
        void enterUserScope(nextUserId);
      } else {
        leaveUserScope();
      }
    });
    unsubscribeAuth = () => authListener.subscription.unsubscribe();

    try {
      await handleAuthRedirect();
    } catch (error) {
      authMessage.value = error instanceof Error ? error.message : String(error);
    }

    const currentUserId = await getCurrentUserId();
    if (currentUserId) {
      await enterUserScope(currentUserId);
    }
  });

  onUnmounted(() => {
    stopSync?.();
    unsubscribeSync?.();
    unsubscribeAuth?.();
    historyReady = false;
    window.removeEventListener('popstate', handlePopState);
    window.removeEventListener('online', handleOnlineRecovery);
    if (timerInterval) window.clearInterval(timerInterval);
  });

  async function enterUserScope(nextUserId: string) {
    if (userId.value === nextUserId && stopSync) {
      await refreshLocalData();
      return;
    }

    userId.value = nextUserId;
    authMessage.value = '';
    stopSync?.();

    await syncBootstrapData(nextUserId, true);
    stopSync = startBackgroundSync(nextUserId);
    await refreshLocalData();
  }

  async function syncBootstrapData(scopeUserId: string, requireOnline: boolean) {
    try {
      await ensureBootstrapData(scopeUserId, requireOnline);
      syncState.lastError = null;
      await refreshLocalData();
    } catch (error) {
      syncState.lastError = error instanceof Error ? error.message : String(error);
    }
  }

  function leaveUserScope() {
    stopSync?.();
    stopSync = undefined;
    userId.value = null;
    projects.value = [];
    tasks.value = [];
    allTasks.value = [];
    logs.value = [];
    reportLogs.value = [];
    projectDurationTotals.value = {};
    taskDurationTotals.value = {};
    groupedLogs.value = [];
    detailLogs.value = [];
    projectLogDetailProjectId.value = null;
    projectLogDetailLogs.value = [];
    runningLog.value = undefined;
    selectedProjectId.value = '';
    selectedTaskId.value = null;
    reportsOpen.value = false;
    settingsOpen.value = false;
    calendarOpen.value = false;
    logOffset.value = 0;
    totalLogCount.value = 0;
    hasMoreLogs.value = true;
    loadingMoreLogs.value = false;
    projectLogOffset.value = 0;
    totalProjectLogCount.value = 0;
    hasMoreProjectLogs.value = true;
    loadingMoreProjectLogs.value = false;
    syncState.pendingCount = 0;
    resetSheets();
    writeHistorySnapshot('replace');
  }

  async function signIn() {
    const requestedEmail = email.value.trim().toLowerCase();
    if (!requestedEmail) return;
    if (!password.value) {
      authMessage.value = 'Enter your password.';
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: requestedEmail,
      password: password.value
    });

    if (error) {
      authMessage.value = error.message;
      return;
    }

    const nextUserId = data.session?.user.id ?? data.user?.id ?? (await getCurrentUserId());
    if (!nextUserId) {
      authMessage.value = 'Signed in, but the session did not initialize on this device.';
      return;
    }

    password.value = '';
    authMessage.value = '';

    await enterUserScope(nextUserId);
  }

  async function signOut() {
    await supabase.auth.signOut();
    leaveUserScope();
  }

  async function synchronizeFromRemote() {
    if (!userId.value) return;

    try {
      await reloadFromRemote(userId.value);
      syncState.lastError = null;
      await refreshLocalData();
    } catch (error) {
      syncState.lastError = error instanceof Error ? error.message : String(error);
    }
  }

  async function refreshLocalData() {
    if (!userId.value) return;

    projects.value = await listProjects(userId.value, includeArchived.value);
    if (!selectedProjectId.value || !projects.value.some((project) => project.id === selectedProjectId.value)) {
      selectedProjectId.value = projects.value[0]?.id ?? '';
    }

    tasks.value = selectedProjectId.value ? sortTasksByStatus(await listTasksForProject(userId.value, selectedProjectId.value, includeArchived.value)) : [];
    allTasks.value = sortTasksByStatus(await listTasks(userId.value));
    if (selectedTaskId.value && !tasks.value.some((task) => task.id === selectedTaskId.value)) {
      selectedTaskId.value = null;
    }

    totalLogCount.value = await countTimeLogs(userId.value);
    const allLogs = await listTimeLogs(userId.value);
    reportLogs.value = allLogs;
    if (allLogs.length && !(await hasLogAggregates(userId.value))) {
      await rebuildLogAggregates(userId.value);
    }
    await loadInitialLogs();
    projectDurationTotals.value = await sumProjectTimeLogDurations(userId.value);
    taskDurationTotals.value = await sumTaskTimeLogDurations(userId.value);
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
    writeHistorySnapshot('replace');
  }

  async function saveSelectedProject() {
    if (!selectedProject.value) return;
    await saveProject(selectedProject.value);
  }

  async function saveProject(project: Project) {
    if (!userId.value || !project.name.trim()) return;
    await updateProject(userId.value, project, {
      name: project.name.trim(),
      color: project.color
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
    writeHistorySnapshot('replace');
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

  async function toggleTaskCompleted(task: Task) {
    if (!userId.value) return;
    await setTaskCompleted(userId.value, task, !task.completed);
    await refreshLocalData();
  }

  async function beginTimer() {
    if (!userId.value || !canStartTimer.value) return;
    const log = await startTimer(userId.value, selectedProjectId.value, selectedTaskId.value);
    applyLogStateMutation(null, log);
  }

  async function switchTimer(projectId: string, taskId: string | null = null) {
    if (!userId.value) return;
    let stoppedLog: TimeLog | undefined;
    if (runningLog.value) {
      stoppedLog = await stopTimer(userId.value, runningLog.value);
      applyLogStateMutation(runningLog.value, stoppedLog);
    }
    selectedProjectId.value = projectId;
    selectedTaskId.value = taskId;
    const startedLog = await startTimer(userId.value, projectId, taskId);
    applyLogStateMutation(null, startedLog);
    resetSheets();
    writeHistorySnapshot('replace');
  }

  async function endTimer() {
    if (!userId.value || !runningLog.value) return;
    const currentRunningLog = runningLog.value;
    const stoppedLog = await stopTimer(userId.value, currentRunningLog);
    applyLogStateMutation(currentRunningLog, stoppedLog);
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

    const updated = await updateTimeLog(userId.value, existing, payload);
    applyLogStateMutation(existing, updated);
    closeLogEditor('replace');
  }

  async function deleteLog(log: TimeLog) {
    if (!userId.value) return;
    await softDeleteTimeLog(userId.value, log);
    const deleted = {
      ...log,
      deleted_at: new Date().toISOString()
    };
    applyLogStateMutation(log, deleted);
    if (editingLogId.value === log.id) {
      closeLogEditor('replace');
    }
  }

  function openLogEditor(log: TimeLog, historyMode: HistorySyncMode = 'push') {
    previousMobileScreen.value = detailGroup.value ? 'detail' : settingsOpen.value ? 'settings' : reportsOpen.value ? 'reports' : calendarOpen.value ? 'calendar' : 'main';
    resetSheets();
    editingLogId.value = log.id;
    populateLogForm(log);
    writeHistorySnapshot(historyMode);
  }

  function closeLogEditor(historyMode: Exclude<HistorySyncMode, 'push'> = 'replace') {
    editingLogId.value = null;
    clearLogForm();
    editPickerMode.value = null;
    if (previousMobileScreen.value !== 'detail') {
      detailGroup.value = null;
    }
    writeHistorySnapshot(historyMode);
  }

  async function openLogDetail(day: string, projectId: string, taskId: string | null, historyMode: HistorySyncMode = 'push') {
    closeLogEditor('none');
    closeProjectLogDetail('none');
    reportsOpen.value = false;
    settingsOpen.value = false;
    calendarOpen.value = false;
    resetSheets();
    detailGroup.value = { day, projectId, taskId };
    if (userId.value) {
      detailLogs.value = await listTimeLogsForGroup(userId.value, day, projectId, taskId);
    }
    writeHistorySnapshot(historyMode);
  }

  function closeLogDetail(historyMode: Exclude<HistorySyncMode, 'push'> = 'replace') {
    const applyClose = () => {
      detailGroup.value = null;
      detailLogs.value = [];
      writeHistorySnapshot(historyMode);
    };

    if (historyMode === 'none') {
      applyClose();
      return;
    }

    navigateBackOr(applyClose);
  }

  async function openProjectLogDetail(projectId: string, historyMode: HistorySyncMode = 'push') {
    closeLogEditor('none');
    closeLogDetail('none');
    reportsOpen.value = false;
    settingsOpen.value = false;
    calendarOpen.value = false;
    resetSheets();
    projectLogDetailProjectId.value = projectId;
    projectLogDetailLogs.value = [];
    await loadInitialProjectLogs(projectId);
    writeHistorySnapshot(historyMode);
  }

  function closeProjectLogDetail(historyMode: Exclude<HistorySyncMode, 'push'> = 'replace') {
    const applyClose = () => {
      resetProjectLogDetailState();
      writeHistorySnapshot(historyMode);
    };

    if (historyMode === 'none') {
      applyClose();
      return;
    }

    navigateBackOr(applyClose);
  }

  function openReports(historyMode: HistorySyncMode = 'push') {
    previousMobileScreen.value = detailGroup.value ? 'detail' : 'main';
    closeLogEditor('none');
    closeLogDetail('none');
    closeProjectLogDetail('none');
    resetSheets();
    settingsOpen.value = false;
    calendarOpen.value = false;
    reportsOpen.value = true;
    writeHistorySnapshot(historyMode);
  }

  function closeReports(historyMode: Exclude<HistorySyncMode, 'push'> = 'replace') {
    const applyClose = () => {
      reportsOpen.value = false;
      writeHistorySnapshot(historyMode);
    };

    if (historyMode === 'none') {
      applyClose();
      return;
    }

    navigateBackOr(applyClose);
  }

  function openSettings(historyMode: HistorySyncMode = 'push') {
    previousMobileScreen.value = detailGroup.value ? 'detail' : 'main';
    closeLogEditor('none');
    closeLogDetail('none');
    closeProjectLogDetail('none');
    resetSheets();
    reportsOpen.value = false;
    calendarOpen.value = false;
    settingsOpen.value = true;
    writeHistorySnapshot(historyMode);
  }

  function closeSettings(historyMode: Exclude<HistorySyncMode, 'push'> = 'replace') {
    const applyClose = () => {
      settingsOpen.value = false;
      writeHistorySnapshot(historyMode);
    };

    if (historyMode === 'none') {
      applyClose();
      return;
    }

    navigateBackOr(applyClose);
  }

  function openCalendar(historyMode: HistorySyncMode = 'push') {
    previousMobileScreen.value = detailGroup.value ? 'detail' : 'main';
    closeLogEditor('none');
    closeLogDetail('none');
    closeProjectLogDetail('none');
    resetSheets();
    reportsOpen.value = false;
    settingsOpen.value = false;
    calendarOpen.value = true;
    writeHistorySnapshot(historyMode);
  }

  function closeCalendar(historyMode: Exclude<HistorySyncMode, 'push'> = 'replace') {
    const applyClose = () => {
      calendarOpen.value = false;
      writeHistorySnapshot(historyMode);
    };

    if (historyMode === 'none') {
      applyClose();
      return;
    }

    navigateBackOr(applyClose);
  }

  function goBackFromEditor() {
    navigateBackOr(() => {
      closeLogEditor('replace');
    });
  }

  function openEditPicker(mode: 'project' | 'task', historyMode: HistorySyncMode = 'push') {
    editPickerMode.value = mode;
    writeHistorySnapshot(historyMode);
  }

  function closeEditPicker(historyMode: Exclude<HistorySyncMode, 'push'> = 'replace') {
    editPickerMode.value = null;
    writeHistorySnapshot(historyMode);
  }

  function selectEditProject(projectId: string) {
    logForm.project_id = projectId;
    handleLogProjectChange();
    closeEditPicker('replace');
  }

  function selectEditTask(taskId: string | null) {
    logForm.task_id = taskId ?? '';
    closeEditPicker('replace');
  }

  function openMenuSheet(historyMode: HistorySyncMode = 'push') {
    closeLogEditor('none');
    projectsSheetOpen.value = false;
    projectCreateOpen.value = false;
    menuSheetOpen.value = true;
    writeHistorySnapshot(historyMode);
  }

  function openTimeline(historyMode: HistorySyncMode = 'push') {
    const returningToCurrentTimeline = menuSheetOpen.value && !reportsOpen.value && !settingsOpen.value && !calendarOpen.value;

    closeLogEditor('none');
    closeLogDetail('none');
    closeProjectLogDetail('none');
    resetSheets();
    reportsOpen.value = false;
    settingsOpen.value = false;
    calendarOpen.value = false;
    timelineScrollTop.value = 0;
    window.scrollTo({ top: 0, behavior: 'auto' });

    if (returningToCurrentTimeline) {
      navigateHistoryDelta(1, () => {
        writeHistorySnapshot('replace');
      });
      return;
    }

    writeHistorySnapshot(historyMode);
  }

  function openProjectsSheet(historyMode: HistorySyncMode = 'push') {
    closeLogEditor('none');
    menuSheetOpen.value = false;
    projectCreateOpen.value = false;
    taskSheetProjectId.value = null;
    taskCreateOpen.value = false;
    projectsSheetOpen.value = true;
    writeHistorySnapshot(historyMode);
  }

  function openProjectCreate(historyMode: HistorySyncMode = 'push') {
    projectCreateOpen.value = true;
    writeHistorySnapshot(historyMode);
  }

  function closeSheets() {
    const historyDepth = currentSheetHistoryDepth();
    navigateHistoryDelta(historyDepth, () => {
      resetSheets();
      writeHistorySnapshot('replace');
    });
  }

  function closeProjectCreate() {
    navigateBackOr(() => {
      projectCreateOpen.value = false;
      writeHistorySnapshot('replace');
    });
  }

  function openProjectTasks(projectId: string, historyMode: HistorySyncMode = 'push') {
    taskSheetProjectId.value = projectId;
    projectCreateOpen.value = false;
    taskCreateOpen.value = false;
    mobileTaskName.value = '';
    writeHistorySnapshot(historyMode);
  }

  function closeProjectTasks() {
    navigateBackOr(() => {
      taskSheetProjectId.value = null;
      taskCreateOpen.value = false;
      mobileTaskName.value = '';
      writeHistorySnapshot('replace');
    });
  }

  function openTaskCreate(historyMode: HistorySyncMode = 'push') {
    taskCreateOpen.value = true;
    writeHistorySnapshot(historyMode);
  }

  function closeTaskCreate() {
    navigateBackOr(() => {
      taskCreateOpen.value = false;
      mobileTaskName.value = '';
      writeHistorySnapshot('replace');
    });
  }

  const projectSwipe = useProjectSwipeActions(openProjectTasks);

  function handleLogProjectChange() {
    if (!logFormTasks.value.some((task) => task.id === logForm.task_id)) {
      logForm.task_id = '';
    }
  }

  function projectById(id: string) {
    return projectMap.value.get(id);
  }

  function taskById(id: string | null) {
    if (!id) return undefined;
    return taskMap.value.get(id);
  }

  function formatDuration(start: string, end: string | null) {
    return formatTimeLogDuration(start, end, ticker.value);
  }

  function logDurationMs(log: TimeLog) {
    return timeLogDurationMs(log, ticker.value);
  }

  function taskTotalDurationMs(taskId: string) {
    const runningMs = runningLog.value?.task_id === taskId ? logDurationMs(runningLog.value) : 0;
    return (taskDurationTotals.value[taskId] ?? 0) + runningMs;
  }

  function projectTotalDurationMs(projectId: string) {
    const runningMs = runningLog.value?.project_id === projectId ? logDurationMs(runningLog.value) : 0;
    return (projectDurationTotals.value[projectId] ?? 0) + runningMs;
  }

  return proxyRefs({
    userId,
    email,
    password,
    authMessage,
    projects,
    tasks,
    allTasks,
    logs,
    reportLogs,
    projectDurationTotals,
    taskDurationTotals,
    selectedProjectId,
    selectedTaskId,
    includeArchived,
    runningLog,
    editingLogId,
    detailGroup,
    projectLogDetailProjectId,
    reportsOpen,
    settingsOpen,
    calendarOpen,
    menuSheetOpen,
    projectsSheetOpen,
    projectCreateOpen,
    taskSheetProjectId,
    taskCreateOpen,
    mobileTaskName,
    editPickerMode,
    syncState,
    projectForm,
    taskForm,
    logForm,
    selectedProject,
    taskSheetProject,
    projectLogDetailProject,
    taskSheetTasks,
    activeTasks,
    logFormTasks,
    visibleLogs,
    canStartTimer,
    currentEditingLog,
    groupedLogs,
    detailLogs,
    projectLogDetailLogs,
    hasMoreLogs,
    loadingMoreLogs,
    hasMoreProjectLogs,
    loadingMoreProjectLogs,
    timelineScrollTop,
    ticker,
    signIn,
    signOut,
    synchronizeFromRemote,
    refreshLocalData,
    loadMoreLogs,
    loadMoreProjectLogs,
    setTimelineScrollTop,
    addProject,
    addMobileProject,
    saveSelectedProject,
    saveProject,
    toggleProjectArchive,
    addTask,
    addMobileTask,
    saveTask,
    toggleTaskArchive,
    toggleTaskCompleted,
    beginTimer,
    switchTimer,
    endTimer,
    saveLog,
    deleteLog,
    openLogEditor,
    closeLogEditor,
    openLogDetail,
    closeLogDetail,
    openProjectLogDetail,
    closeProjectLogDetail,
    openReports,
    closeReports,
    openSettings,
    closeSettings,
    openCalendar,
    closeCalendar,
    goBackFromEditor,
    openEditPicker,
    closeEditPicker,
    selectEditProject,
    selectEditTask,
    openMenuSheet,
    openTimeline,
    openProjectsSheet,
    openProjectCreate,
    closeProjectCreate,
    closeSheets,
    closeProjectTasks,
    openTaskCreate,
    closeTaskCreate,
    handleProjectSwipeStart: projectSwipe.handleProjectSwipeStart,
    handleProjectSwipeMove: projectSwipe.handleProjectSwipeMove,
    handleProjectSwipeEnd: projectSwipe.handleProjectSwipeEnd,
    handleProjectSwipeCancel: projectSwipe.handleProjectSwipeCancel,
    handleLogProjectChange,
    projectById,
    taskById,
    formatDuration,
    formatDurationMs,
    projectTotalDurationMs,
    taskTotalDurationMs,
    formatDateTime,
    dayKey,
    formatTime
  });
}

export type TimeTrackerAppContext = ReturnType<typeof useTimeTrackerApp>;
