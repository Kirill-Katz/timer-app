import { onUnmounted } from 'vue';

const OPEN_TASKS_SCROLL_THRESHOLD_PX = 150;
const SWIPE_RESET_DELAY_MS = 120;
const SWIPE_CLICK_SUPPRESS_MS = 400;

export function useProjectSwipeActions(
  openProjectTasks: (projectId: string) => void,
  openProjectLogDetail: (projectId: string) => void
) {
  let resetTimer: number | undefined;
  let openedProjectId: string | null = null;
  let suppressedClickProjectId: string | null = null;
  let suppressClickUntil = 0;

  function clearResetTimer() {
    if (!resetTimer) return;
    window.clearTimeout(resetTimer);
    resetTimer = undefined;
  }

  function scheduleReset(row: HTMLElement) {
    clearResetTimer();
    resetTimer = window.setTimeout(() => {
      resetTimer = undefined;
      row.scrollLeft = 0;
    }, SWIPE_RESET_DELAY_MS);
  }

  function handleProjectSwipeScroll(event: Event, projectId: string) {
    const row = event.currentTarget as HTMLElement | null;
    if (!row || openedProjectId === projectId) return;

    if (row.scrollLeft >= OPEN_TASKS_SCROLL_THRESHOLD_PX) {
      clearResetTimer();
      openedProjectId = projectId;
      suppressedClickProjectId = projectId;
      suppressClickUntil = performance.now() + SWIPE_CLICK_SUPPRESS_MS;
      openProjectTasks(projectId);
      row.scrollLeft = 0;
      window.setTimeout(() => {
        if (openedProjectId === projectId) {
          openedProjectId = null;
        }
      }, SWIPE_CLICK_SUPPRESS_MS);
      return;
    }

    scheduleReset(row);
  }

  function handleProjectCardClick(projectId: string) {
    if (suppressedClickProjectId === projectId && performance.now() <= suppressClickUntil) {
      return;
    }

    if (suppressedClickProjectId === projectId) {
      suppressedClickProjectId = null;
    }

    openProjectLogDetail(projectId);
  }

  onUnmounted(clearResetTimer);

  return {
    handleProjectSwipeScroll,
    handleProjectCardClick
  };
}
