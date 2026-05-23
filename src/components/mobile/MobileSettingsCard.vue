<script setup lang="ts">
defineProps<{
  label: string;
}>();
</script>

<template>
  <div class="rounded-lg border border-line bg-panel p-3">
    <div class="flex items-center justify-between gap-3">
      <span class="font-normal">{{ label }}</span>
      <slot name="value"></slot>
    </div>
    <slot></slot>
  </div>
</template>
