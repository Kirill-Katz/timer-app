<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next';

withDefaults(defineProps<{
  label?: string;
  ariaLabel?: string;
  compact?: boolean;
}>(), {
  label: '',
  ariaLabel: 'Back',
  compact: true
});

const emit = defineEmits<{
  click: [];
}>();
</script>

<template>
  <button
    class="btn-secondary btn-icon inline-flex min-h-10 items-center justify-center font-normal"
    :class="compact ? 'w-12' : 'gap-2 px-3'"
    type="button"
    :aria-label="ariaLabel"
    @click="emit('click')"
  >
    <ArrowLeft :size="18" />
    <span v-if="label">{{ label }}</span>
  </button>
</template>
