<script setup lang="ts">
defineProps<{
  label: string;
}>();
</script>

<template>
  <label class="grid gap-1 text-sm font-bold text-stone-300">
    {{ label }}
    <slot></slot>
  </label>
</template>
