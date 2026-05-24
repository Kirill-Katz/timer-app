export function isWindowNearBottom(thresholdPx = 96) {
  const remaining = document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
  return remaining <= thresholdPx;
}

export function isElementNearBottom(target: HTMLElement, thresholdPx = 120) {
  const remaining = target.scrollHeight - target.scrollTop - target.clientHeight;
  return remaining <= thresholdPx;
}
