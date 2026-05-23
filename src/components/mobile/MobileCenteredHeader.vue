<script setup lang="ts">
import MobileBackButton from './MobileBackButton.vue';

withDefaults(defineProps<{
  title?: string;
  subtitle?: string;
  color?: string;
  backLabel?: string;
  backAriaLabel?: string;
}>(), {
  title: '',
  subtitle: '',
  color: '',
  backLabel: '',
  backAriaLabel: 'Back'
});

const emit = defineEmits<{
  back: [];
}>();
</script>

<template>
  <div class="relative grid min-h-10 justify-items-center gap-1">
    <MobileBackButton class="absolute left-0" :label="backLabel" :aria-label="backAriaLabel" @click="emit('back')" />
    <div class="mx-14 flex min-w-0 items-center justify-center gap-2">
      <span v-if="color" class="h-3 w-3 flex-none rounded-full border border-black/10" :style="{ backgroundColor: color }"></span>
      <h2 class="truncate text-center text-xl font-medium">{{ title }}</h2>
    </div>
    <p v-if="subtitle" class="mx-14 truncate text-center text-sm font-normal text-stone-300">{{ subtitle }}</p>
  </div>
</template>
