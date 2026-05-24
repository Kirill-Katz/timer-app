const MAX_SWIPE_REVEAL_PX = 120;
const OPEN_TASKS_SWIPE_THRESHOLD_PX = 16;
const FAST_SWIPE_THRESHOLD_PX = 10;
const FAST_SWIPE_VELOCITY_PX_PER_MS = 0.35;
const SWIPE_FOLLOW_MULTIPLIER = 1.35;
const SWIPE_RESET_DURATION_MS = 120;

export function useProjectSwipeActions(openProjectTasks: (projectId: string) => void) {
  let swipeStartX = 0;
  let swipeStartY = 0;
  let swipeStartTime = 0;
  let swipingProjectId: string | null = null;
  let swipeCardElement: HTMLElement | null = null;
  let frameId = 0;
  let pendingOffsetX = 0;
  let swipingHorizontally = false;

  function queueSwipeOffset(offsetX: number) {
    pendingOffsetX = offsetX;
    if (frameId) return;

    frameId = requestAnimationFrame(() => {
      frameId = 0;
      if (!swipeCardElement) return;
      swipeCardElement.style.transform = `translate3d(${pendingOffsetX}px, 0, 0)`;
    });
  }

  function resetSwipeCard(animate: boolean) {
    if (frameId) {
      cancelAnimationFrame(frameId);
      frameId = 0;
    }

    if (!swipeCardElement) return;

    swipeCardElement.style.transitionDuration = animate ? `${SWIPE_RESET_DURATION_MS}ms` : '0ms';
    swipeCardElement.style.transform = 'translate3d(0px, 0, 0)';
    swipeCardElement.style.willChange = animate ? 'auto' : 'transform';
  }

  function clearSwipeState() {
    swipingProjectId = null;
    swipeCardElement = null;
    swipeStartTime = 0;
    swipingHorizontally = false;
  }

  function handleProjectSwipeStart(event: TouchEvent) {
    swipeStartX = event.touches[0]?.clientX ?? 0;
    swipeStartY = event.touches[0]?.clientY ?? 0;
    swipeStartTime = event.timeStamp;
    swipingProjectId = (event.currentTarget as HTMLElement | null)?.dataset.projectId ?? null;
    swipeCardElement = (event.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>('[data-swipe-card]') ?? null;
    swipingHorizontally = false;
    if (swipeCardElement) {
      swipeCardElement.style.transitionDuration = '0ms';
      swipeCardElement.style.willChange = 'transform';
    }
    queueSwipeOffset(0);
  }

  function handleProjectSwipeMove(event: TouchEvent, projectId: string) {
    const touch = event.touches[0];
    if (!touch || swipingProjectId !== projectId) return;

    const deltaX = touch.clientX - swipeStartX;
    const deltaY = touch.clientY - swipeStartY;
    if (!swipingHorizontally && deltaX < 0 && Math.abs(deltaX) > Math.abs(deltaY) + 4) {
      swipingHorizontally = true;
    }

    if (swipingHorizontally) {
      event.preventDefault();
    }

    if (deltaX < 0 && Math.abs(deltaY) < 45) {
      queueSwipeOffset(Math.max(deltaX * SWIPE_FOLLOW_MULTIPLIER, -MAX_SWIPE_REVEAL_PX));
    }
  }

  function handleProjectSwipeEnd(event: TouchEvent, projectId: string) {
    const touch = event.changedTouches[0];
    if (!touch || swipingProjectId !== projectId) {
      resetSwipeCard(true);
      clearSwipeState();
      return;
    }

    const deltaX = touch.clientX - swipeStartX;
    const deltaY = touch.clientY - swipeStartY;
    const elapsedMs = Math.max(event.timeStamp - swipeStartTime, 1);
    const swipeVelocity = Math.abs(deltaX) / elapsedMs;
    const crossedDistanceThreshold = deltaX < -OPEN_TASKS_SWIPE_THRESHOLD_PX;
    const crossedFastSwipeThreshold = deltaX < -FAST_SWIPE_THRESHOLD_PX && swipeVelocity >= FAST_SWIPE_VELOCITY_PX_PER_MS;

    if ((crossedDistanceThreshold || crossedFastSwipeThreshold) && Math.abs(deltaY) < 35) {
      openProjectTasks(projectId);
    }
    resetSwipeCard(true);
    clearSwipeState();
  }

  function handleProjectSwipeCancel() {
    resetSwipeCard(true);
    clearSwipeState();
  }

  return {
    handleProjectSwipeStart,
    handleProjectSwipeMove,
    handleProjectSwipeEnd,
    handleProjectSwipeCancel
  };
}
