<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useBodyScrollLock } from '../../composables/useBodyScrollLock';

const props = withDefaults(defineProps<{
  show: boolean;
  zClass?: string;
  minHeightClass?: string;
  contentClass?: string;
  expandable?: boolean;
  initialHeightRatio?: number;
  maxTopOffset?: number;
}>(), {
  zClass: 'z-50',
  minHeightClass: 'min-h-[50vh]',
  contentClass: '',
  expandable: false,
  initialHeightRatio: 0.62,
  maxTopOffset: 12
});

const emit = defineEmits<{
  close: [];
}>();

defineSlots<{
  default(props: { expanded: boolean }): unknown;
}>();

const sheetHeight = ref(0);
const lastTouchY = ref(0);

const maxHeight = computed(() => Math.max(0, window.innerHeight - (props.maxTopOffset ?? 12)));
const initialHeight = computed(() => Math.round(window.innerHeight * (props.initialHeightRatio ?? 0.62)));
const expanded = computed(() => !props.expandable || sheetHeight.value >= maxHeight.value - 1);

const sheetStyle = computed(() => {
  if (!props.expandable) return undefined;
  return {
    height: `${sheetHeight.value}px`
  };
});

function resetSheetHeight() {
  if (!props.expandable) return;
  sheetHeight.value = Math.min(maxHeight.value, initialHeight.value);
}

function resizeSheet(deltaY: number) {
  if (!props.expandable || deltaY === 0) return false;

  const nextHeight = Math.max(initialHeight.value, Math.min(maxHeight.value, sheetHeight.value - deltaY));
  const changed = nextHeight !== sheetHeight.value;
  sheetHeight.value = nextHeight;
  return changed;
}

function scrollableTarget(event: Event): HTMLElement | null {
  const target = event.target instanceof Element ? event.target : null;
  return target?.closest('[data-sheet-scroll]') as HTMLElement | null;
}

function shouldResizeBeforeScroll(deltaY: number, scrollTarget: HTMLElement | null) {
  if (!props.expandable) return false;
  if (deltaY < 0 && !expanded.value) return true;
  if (deltaY > 0 && (!scrollTarget || scrollTarget.scrollTop <= 0)) return sheetHeight.value > initialHeight.value;
  return false;
}

function handleWheel(event: WheelEvent) {
  if (!props.expandable) return;

  const scrollTarget = scrollableTarget(event);
  if (!shouldResizeBeforeScroll(event.deltaY, scrollTarget)) return;

  event.preventDefault();
  resizeSheet(event.deltaY);
}

function handleTouchStart(event: TouchEvent) {
  if (!props.expandable) return;
  const y = event.touches[0]?.clientY ?? 0;
  lastTouchY.value = y;
}

function handleTouchMove(event: TouchEvent) {
  if (!props.expandable) return;

  const y = event.touches[0]?.clientY ?? lastTouchY.value;
  const deltaY = lastTouchY.value - y;
  lastTouchY.value = y;

  const scrollTarget = scrollableTarget(event);
  if (!shouldResizeBeforeScroll(deltaY, scrollTarget)) return;

  event.preventDefault();
  resizeSheet(deltaY);
}

function handleWindowResize() {
  if (!props.show || !props.expandable) return;
  sheetHeight.value = Math.min(maxHeight.value, Math.max(initialHeight.value, sheetHeight.value));
}

watch(() => props.show, async (show) => {
  if (!show) return;
  await nextTick();
  resetSheetHeight();
}, { immediate: true });

watch(() => props.expandable, resetSheetHeight);

window.addEventListener('resize', handleWindowResize);

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleWindowResize);
});

useBodyScrollLock(() => props.show);
</script>

<template>
  <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0" enter-to-class="opacity-100" leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0">
    <div v-if="show" class="fixed inset-0 bg-black/20" :class="zClass" @click="emit('close')" @wheel.self.prevent @touchmove.self.prevent>
      <div
        class="absolute inset-x-0 bottom-0 flex flex-col rounded-t-3xl border border-line bg-panel p-4 shadow-soft transition-[height] duration-200 ease-out"
        :class="[expandable ? 'overflow-hidden' : minHeightClass, contentClass]"
        :style="sheetStyle"
        @click.stop
        @wheel="handleWheel"
        @touchstart.passive="handleTouchStart"
        @touchmove="handleTouchMove"
      >
        <div class="mx-auto mb-4 h-1 w-12 rounded-full bg-line"></div>
        <slot :expanded="expanded"></slot>
      </div>
    </div>
  </Transition>
</template>
