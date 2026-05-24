import { ref } from 'vue';

export function useProjectSwipeActions(openProjectTasks: (projectId: string) => void) {
  const swipeStartX = ref(0);
  const swipeStartY = ref(0);
  const swipingProjectId = ref<string | null>(null);
  const swipeOffsetX = ref(0);

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

  return {
    swipingProjectId,
    handleProjectSwipeStart,
    handleProjectSwipeMove,
    handleProjectSwipeEnd,
    projectSwipeStyle
  };
}
