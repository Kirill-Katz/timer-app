<script setup lang="ts">
import MobileOverlay from './MobileOverlay.vue';

withDefaults(defineProps<{
  show: boolean;
  title: string;
  contentClass?: string;
}>(), {
  contentClass: 'px-4 py-5 pb-24'
});
</script>

<template>
  <MobileOverlay :show="show" :content-class="contentClass">
    <div class="mb-4">
      <h2 class="text-center text-xl font-medium">{{ title }}</h2>
    </div>
    <slot></slot>
  </MobileOverlay>
</template>
