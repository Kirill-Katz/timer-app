import { ref } from 'vue';

const MAX_SWIPE_REVEAL_PX = 120;
const OPEN_TASKS_SWIPE_THRESHOLD_PX = 16;
const FAST_SWIPE_THRESHOLD_PX = 10;
const FAST_SWIPE_VELOCITY_PX_PER_MS = 0.35;
const SWIPE_FOLLOW_MULTIPLIER = 1.35;
const SWIPE_RESET_DURATION_MS = 120;

export function useProjectSwipeActions(openProjectTasks: (projectId: string) => void) {
  const swipeStartX = ref(0);
  const swipeStartY = ref(0);
  const swipeStartTime = ref(0);
  const swipingProjectId = ref<string | null>(null);
  const swipeCardElement = ref<HTMLElement | null>(null);
  let frameId = 0;
  let pendingOffsetX = 0;

  function queueSwipeOffset(offsetX: number) {
    pendingOffsetX = offsetX;
    if (frameId) return;

    frameId = requestAnimationFrame(() => {
      frameId = 0;
      if (!swipeCardElement.value) return;
      swipeCardElement.value.style.transform = `translate3d(${pendingOffsetX}px, 0, 0)`;
    });
  }

  function resetSwipeCard(animate: boolean) {
    if (frameId) {
      cancelAnimationFrame(frameId);
      frameId = 0;
    }

    if (!swipeCardElement.value) return;

    swipeCardElement.value.style.transitionDuration = animate ? `${SWIPE_RESET_DURATION_MS}ms` : '0ms';
    swipeCardElement.value.style.transform = 'translate3d(0px, 0, 0)';
    swipeCardElement.value.style.willChange = animate ? 'auto' : 'transform';
  }

  function handleProjectSwipeStart(event: TouchEvent) {
    swipeStartX.value = event.touches[0]?.clientX ?? 0;
    swipeStartY.value = event.touches[0]?.clientY ?? 0;
    swipeStartTime.value = event.timeStamp;
    swipingProjectId.value = (event.currentTarget as HTMLElement | null)?.dataset.projectId ?? null;
    swipeCardElement.value = (event.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>('[data-swipe-card]') ?? null;
    if (swipeCardElement.value) {
      swipeCardElement.value.style.transitionDuration = '0ms';
      swipeCardElement.value.style.willChange = 'transform';
    }
    queueSwipeOffset(0);
  }

  function handleProjectSwipeMove(event: TouchEvent, projectId: string) {
    const touch = event.touches[0];
    if (!touch || swipingProjectId.value !== projectId) return;

    const deltaX = touch.clientX - swipeStartX.value;
    const deltaY = touch.clientY - swipeStartY.value;
    if (deltaX < 0 && Math.abs(deltaY) < 45) {
      queueSwipeOffset(Math.max(deltaX * SWIPE_FOLLOW_MULTIPLIER, -MAX_SWIPE_REVEAL_PX));
    }
  }

  function handleProjectSwipeEnd(event: TouchEvent, projectId: string) {
    const touch = event.changedTouches[0];
    if (!touch) return;

    const deltaX = touch.clientX - swipeStartX.value;
    const deltaY = touch.clientY - swipeStartY.value;
    const elapsedMs = Math.max(event.timeStamp - swipeStartTime.value, 1);
    const swipeVelocity = Math.abs(deltaX) / elapsedMs;
    const crossedDistanceThreshold = deltaX < -OPEN_TASKS_SWIPE_THRESHOLD_PX;
    const crossedFastSwipeThreshold = deltaX < -FAST_SWIPE_THRESHOLD_PX && swipeVelocity >= FAST_SWIPE_VELOCITY_PX_PER_MS;

    if ((crossedDistanceThreshold || crossedFastSwipeThreshold) && Math.abs(deltaY) < 35) {
      openProjectTasks(projectId);
    }
    resetSwipeCard(true);
    swipingProjectId.value = null;
    swipeCardElement.value = null;
    swipeStartTime.value = 0;
  }

  function projectSwipeStyle(projectId: string) {
    void projectId;
    return {};
  }

  return {
    swipingProjectId,
    handleProjectSwipeStart,
    handleProjectSwipeMove,
    handleProjectSwipeEnd,
    projectSwipeStyle
  };
}
