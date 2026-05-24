import { computed, onMounted, onUnmounted, proxyRefs, reactive, ref } from 'vue';
import { supabase, getCurrentUserId, handleAuthRedirect } from '../services/supabase';
import { completedTimeLogDurationMs, durationBetweenMs, timeLogDurationMs } from './useTimeLogDuration';
import { hasLogAggregates, rebuildLogAggregates } from '../services/log-aggregates';
import { ensureBootstrapData, reloadFromRemote, startBackgroundSync, subscribeSyncState, type SyncState } from '../services/sync-queue';
import { createProject, listProjects, setProjectArchived, updateProject } from '../stores/projects';
import { createTask, listTasks, listTasksForProject, setTaskArchived, setTaskCompleted, updateTask } from '../stores/tasks';
import { countProjectTimeLogs, countTimeLogs, getRunningLog, listProjectTimeLogsPage, listTimeLogs, listTimeLogsForGroup, listTimeLogsPage, softDeleteTimeLog, startTimer, stopTimer, sumProjectTimeLogDurations, sumTaskTimeLogDurations, updateTimeLog } from '../stores/time-logs';
import type { DetailGroup, GroupedLogEntry, GroupedLogSection, Project, Task, TimeLog } from '../types';

export function useTimeTrackerApp() {
  const MOBILE_TIMELINE_PAGE_SIZE = 50;
  const sortTasks = (taskList: Task[]) => taskList.slice().sort(compareTasks);

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
  const previousMobileScreen = ref<'main' | 'detail' | 'settings' | 'reports'>('main');
  const reportsOpen = ref(false);
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

  const selectedProject = computed(() => projects.value.find((project) => project.id === selectedProjectId.value));
  const taskSheetProject = computed(() => projects.value.find((project) => project.id === taskSheetProjectId.value));
  const projectLogDetailProject = computed(() => projects.value.find((project) => project.id === projectLogDetailProjectId.value));
  const taskSheetTasks = computed(() => sortTasks(allTasks.value.filter((task) => task.project_id === taskSheetProjectId.value && (includeArchived.value || !task.archived))));
  const activeTasks = computed(() => sortTasks(tasks.value.filter((task) => includeArchived.value || !task.archived)));
  const logFormTasks = computed(() => sortTasks(allTasks.value.filter((task) => task.project_id === logForm.project_id && (includeArchived.value || !task.archived))));
  const visibleLogs = computed(() => logs.value.filter((log) => includeArchived.value || !projectById(log.project_id)?.archived));
  const canStartTimer = computed(() => Boolean(userId.value && selectedProjectId.value && !runningLog.value));
  const currentEditingLog = computed(() => editingLogId.value ? logs.value.find((log) => log.id === editingLogId.value) : undefined);

  function compareTasks(a: Task, b: Task) {
    return Number(Boolean(a.completed)) - Number(Boolean(b.completed)) || a.created_at.localeCompare(b.created_at);
  }

  function buildGroupedLogs(logList: TimeLog[]) {
    const groups = new Map<string, { totalMs: number; entries: Map<string, GroupedLogEntry> }>();
    logList.forEach((log) => {
      const label = dayLabel(log.start_time);
      const group = groups.get(label) ?? { totalMs: 0, entries: new Map<string, GroupedLogEntry>() };
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

    return Array.from(groups.entries(), ([label, group]) => ({
      label,
      totalMs: group.totalMs,
      entries: Array.from(group.entries.values()).sort((a, b) => new Date(b.latestStart).getTime() - new Date(a.latestStart).getTime())
    }));
  }

  function updateProjectDurationTotal(projectId: string, deltaMs: number) {
    if (!deltaMs) return;
    const nextTotal = Math.max(0, (projectDurationTotals.value[projectId] ?? 0) + deltaMs);
    if (nextTotal) {
      projectDurationTotals.value = {
        ...projectDurationTotals.value,
        [projectId]: nextTotal
      };
      return;
    }

    const { [projectId]: _removed, ...rest } = projectDurationTotals.value;
    projectDurationTotals.value = rest;
  }

  function updateTaskDurationTotal(taskId: string | null, deltaMs: number) {
    if (!taskId || !deltaMs) return;
    const nextTotal = Math.max(0, (taskDurationTotals.value[taskId] ?? 0) + deltaMs);
    if (nextTotal) {
      taskDurationTotals.value = {
        ...taskDurationTotals.value,
        [taskId]: nextTotal
      };
      return;
    }

    const { [taskId]: _removed, ...rest } = taskDurationTotals.value;
    taskDurationTotals.value = rest;
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

  function sortLogsDesc(logList: TimeLog[]) {
    return logList.slice().sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
  }

  function rebuildDerivedLogState() {
    groupedLogs.value = buildGroupedLogs(visibleLogs.value);
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

    const page = await listTimeLogsPage(userId.value, 0, MOBILE_TIMELINE_PAGE_SIZE);
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
    logOffset.value = 0;
    totalLogCount.value = 0;
    hasMoreLogs.value = true;
    loadingMoreLogs.value = false;
    projectLogOffset.value = 0;
    totalProjectLogCount.value = 0;
    hasMoreProjectLogs.value = true;
    loadingMoreProjectLogs.value = false;
    syncState.pendingCount = 0;
    closeSheets();
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

    tasks.value = selectedProjectId.value ? sortTasks(await listTasksForProject(userId.value, selectedProjectId.value, includeArchived.value)) : [];
    allTasks.value = sortTasks(await listTasks(userId.value));
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
    closeSheets();
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
    closeLogEditor();
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
      closeLogEditor();
    }
  }

  function openLogEditor(log: TimeLog) {
    previousMobileScreen.value = detailGroup.value ? 'detail' : settingsOpen.value ? 'settings' : reportsOpen.value ? 'reports' : 'main';
    reportsOpen.value = false;
    settingsOpen.value = false;
    closeSheets();
    editingLogId.value = log.id;
    logForm.project_id = log.project_id;
    logForm.task_id = log.task_id ?? '';
    logForm.date = toDateLocal(log.start_time);
    logForm.start_time = toTimeLocal(log.start_time);
    logForm.end_time = log.end_time ? toTimeLocal(log.end_time) : '';
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

  async function openLogDetail(day: string, projectId: string, taskId: string | null) {
    closeLogEditor();
    closeProjectLogDetail();
    reportsOpen.value = false;
    settingsOpen.value = false;
    closeSheets();
    detailGroup.value = { day, projectId, taskId };
    if (userId.value) {
      detailLogs.value = await listTimeLogsForGroup(userId.value, day, projectId, taskId);
    }
  }

  function closeLogDetail() {
    detailGroup.value = null;
    detailLogs.value = [];
  }

  async function openProjectLogDetail(projectId: string) {
    closeLogEditor();
    closeLogDetail();
    reportsOpen.value = false;
    settingsOpen.value = false;
    closeSheets();
    projectLogDetailProjectId.value = projectId;
    projectLogDetailLogs.value = [];
    await loadInitialProjectLogs(projectId);
  }

  function closeProjectLogDetail() {
    projectLogDetailProjectId.value = null;
    projectLogDetailLogs.value = [];
    projectLogOffset.value = 0;
    totalProjectLogCount.value = 0;
    hasMoreProjectLogs.value = true;
    loadingMoreProjectLogs.value = false;
  }

  function openReports() {
    previousMobileScreen.value = detailGroup.value ? 'detail' : 'main';
    closeLogEditor();
    closeLogDetail();
    closeProjectLogDetail();
    closeSheets();
    settingsOpen.value = false;
    reportsOpen.value = true;
  }

  function closeReports() {
    reportsOpen.value = false;
  }

  function openSettings() {
    previousMobileScreen.value = detailGroup.value ? 'detail' : 'main';
    closeLogEditor();
    closeLogDetail();
    closeProjectLogDetail();
    closeSheets();
    reportsOpen.value = false;
    settingsOpen.value = true;
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
    projectsSheetOpen.value = false;
    projectCreateOpen.value = false;
    menuSheetOpen.value = true;
  }

  function openTimeline() {
    closeLogEditor();
    closeLogDetail();
    closeProjectLogDetail();
    closeSheets();
    reportsOpen.value = false;
    settingsOpen.value = false;
    timelineScrollTop.value = 0;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openProjectsSheet() {
    closeLogEditor();
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
    return formatDurationMs(durationBetweenMs(start, end ? new Date(end).getTime() : ticker.value));
  }

  function formatDurationMs(ms: number) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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
    goBackFromEditor,
    openEditPicker,
    closeEditPicker,
    selectEditProject,
    selectEditTask,
    openMenuSheet,
    openTimeline,
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
    projectTotalDurationMs,
    taskTotalDurationMs,
    formatDateTime,
    dayKey,
    formatTime
  });
}

export type TimeTrackerAppContext = ReturnType<typeof useTimeTrackerApp>;
