<script setup lang="ts" generic="T">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

interface VirtualRow<TItem> {
  item: TItem;
  index: number;
  top: number;
  height: number;
}

const props = withDefaults(defineProps<{
  items: T[];
  itemHeight?: number;
  getItemHeight?: (item: T, index: number) => number;
  itemKey?: string;
  overscan?: number;
}>(), {
  itemHeight: 56,
  itemKey: 'id',
  overscan: 6
});

defineSlots<{
  default(props: { item: T; index: number }): unknown;
  empty(): unknown;
}>();

const containerRef = ref<HTMLElement | null>(null);
const scrollTop = ref(0);
const viewportHeight = ref(0);

let resizeObserver: ResizeObserver | undefined;

const metrics = computed(() => {
  const offsets: number[] = [];
  const heights: number[] = [];
  let totalHeight = 0;

  props.items.forEach((item, index) => {
    offsets.push(totalHeight);
    const height = props.getItemHeight ? props.getItemHeight(item, index) : props.itemHeight;
    heights.push(height);
    totalHeight += height;
  });

  return { offsets, heights, totalHeight };
});

const visibleRange = computed(() => {
  const { offsets, heights } = metrics.value;
  if (!offsets.length) {
    return { start: 0, end: 0 };
  }

  const start = Math.max(0, findIndexAtOffset(offsets, heights, scrollTop.value) - props.overscan);
  const endOffset = scrollTop.value + viewportHeight.value;
  const end = Math.min(props.items.length, findIndexAtOffset(offsets, heights, endOffset) + props.overscan + 1);

  return { start, end };
});

const visibleRows = computed(() => {
  const rows: VirtualRow<T>[] = [];
  const { offsets, heights } = metrics.value;
  const { start, end } = visibleRange.value;

  for (let index = start; index < end; index += 1) {
    rows.push({
      item: props.items[index],
      index,
      top: offsets[index],
      height: heights[index]
    });
  }

  return rows;
});

function findIndexAtOffset(offsets: number[], heights: number[], target: number) {
  let low = 0;
  let high = offsets.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const start = offsets[mid];
    const end = start + heights[mid];

    if (target < start) {
      high = mid - 1;
    } else if (target >= end) {
      low = mid + 1;
    } else {
      return mid;
    }
  }

  return Math.max(0, Math.min(low, offsets.length - 1));
}

function rowKey(item: T, index: number): string | number {
  if (item && typeof item === 'object' && props.itemKey in item) {
    const key = (item as Record<string, unknown>)[props.itemKey];
    if (typeof key === 'string' || typeof key === 'number') {
      return key;
    }
  }
  return index;
}

function syncViewport() {
  viewportHeight.value = containerRef.value?.clientHeight ?? 0;
}

function handleScroll() {
  scrollTop.value = containerRef.value?.scrollTop ?? 0;
}

watch(() => props.items.length, () => {
  handleScroll();
  syncViewport();
});

onMounted(() => {
  syncViewport();
  handleScroll();

  resizeObserver = new ResizeObserver(() => {
    syncViewport();
  });

  if (containerRef.value) {
    resizeObserver.observe(containerRef.value);
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
});
</script>

<template>
  <div ref="containerRef" class="min-h-0 overflow-auto" @scroll="handleScroll">
    <div v-if="items.length" class="relative" :style="{ height: `${metrics.totalHeight}px` }">
      <div
        v-for="row in visibleRows"
        :key="rowKey(row.item, row.index)"
        class="absolute inset-x-0"
        :style="{ transform: `translateY(${row.top}px)`, height: `${row.height}px` }"
      >
        <slot :item="row.item" :index="row.index"></slot>
      </div>
    </div>
    <slot v-else name="empty"></slot>
  </div>
</template>
