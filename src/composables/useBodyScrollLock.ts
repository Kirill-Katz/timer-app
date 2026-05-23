import { onBeforeUnmount, watch, type WatchSource } from 'vue';

let lockCount = 0;
let lockedScrollY = 0;
let previousBodyStyles: Partial<CSSStyleDeclaration> = {};

function lockBodyScroll() {
  lockCount += 1;
  if (lockCount > 1) return;

  lockedScrollY = window.scrollY;
  previousBodyStyles = {
    position: document.body.style.position,
    top: document.body.style.top,
    left: document.body.style.left,
    right: document.body.style.right,
    width: document.body.style.width,
    overflow: document.body.style.overflow
  };

  document.body.style.position = 'fixed';
  document.body.style.top = `-${lockedScrollY}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
  document.body.style.overflow = 'hidden';
}

function unlockBodyScroll() {
  if (!lockCount) return;

  lockCount -= 1;
  if (lockCount) return;

  document.body.style.position = previousBodyStyles.position ?? '';
  document.body.style.top = previousBodyStyles.top ?? '';
  document.body.style.left = previousBodyStyles.left ?? '';
  document.body.style.right = previousBodyStyles.right ?? '';
  document.body.style.width = previousBodyStyles.width ?? '';
  document.body.style.overflow = previousBodyStyles.overflow ?? '';
  window.scrollTo({ top: lockedScrollY, behavior: 'auto' });
}

export function useBodyScrollLock(locked: WatchSource<boolean>) {
  let active = false;

  const stop = watch(locked, (nextLocked) => {
    if (nextLocked && !active) {
      active = true;
      lockBodyScroll();
      return;
    }

    if (!nextLocked && active) {
      active = false;
      unlockBodyScroll();
    }
  }, { immediate: true });

  onBeforeUnmount(() => {
    stop();
    if (active) {
      active = false;
      unlockBodyScroll();
    }
  });
}
