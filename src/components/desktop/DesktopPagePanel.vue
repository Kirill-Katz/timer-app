<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next';

defineProps<{
  title: string;
  backLabel?: string;
}>();

const emit = defineEmits<{
  back: [];
}>();
</script>

<template>
  <section class="grid gap-4">
    <section class="min-h-[calc(100vh-8rem)] rounded-lg border border-line bg-panel p-4 shadow-soft">
      <div class="mb-4 flex items-center justify-between gap-3">
        <button class="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-transparent px-3 font-normal text-ink" type="button" @click="emit('back')">
          <ArrowLeft :size="18" /> {{ backLabel ?? 'Back' }}
        </button>
      </div>
      <div class="mb-5">
        <h2 class="text-3xl font-medium leading-none">{{ title }}</h2>
      </div>
      <slot></slot>
    </section>
  </section>
</template>
