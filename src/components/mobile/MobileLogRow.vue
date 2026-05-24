<script setup lang="ts">
import type { TimeLog } from '../../types';

defineProps<{
  log: TimeLog;
  timeLabel: string;
  durationLabel: string;
  metaLabel?: string;
}>();

const emit = defineEmits<{
  open: [log: TimeLog];
}>();
</script>

<template>
  <article class="grid cursor-pointer grid-cols-1 border-b border-line px-1 py-2" @click="emit('open', log)">
    <div class="min-w-0">
      <p class="font-medium">{{ timeLabel }}</p>
      <p class="text-xs font-normal text-stone-300">
        {{ metaLabel ? `${metaLabel} · ${durationLabel}` : durationLabel }}
      </p>
    </div>
  </article>
</template>
