<script setup lang="ts">
import { useBodyScrollLock } from '../../composables/useBodyScrollLock';

const props = withDefaults(defineProps<{
  show: boolean;
  zClass?: string;
  minHeightClass?: string;
  contentClass?: string;
}>(), {
  zClass: 'z-50',
  minHeightClass: 'min-h-[50vh]',
  contentClass: ''
});

const emit = defineEmits<{
  close: [];
}>();

useBodyScrollLock(() => props.show);
</script>

<template>
  <Transition enter-active-class="transition duration-0 ease-linear" enter-from-class="opacity-100" enter-to-class="opacity-100" leave-active-class="transition duration-0 ease-linear" leave-from-class="opacity-100" leave-to-class="opacity-100">
    <div v-if="show" class="fixed inset-0 bg-black/20" :class="zClass" @click="emit('close')" @wheel.self.prevent @touchmove.self.prevent>
      <div
        class="absolute inset-x-0 bottom-0 rounded-t-3xl border border-line bg-panel p-4 shadow-soft transition duration-0 ease-linear"
        :class="[minHeightClass, contentClass]"
        @click.stop
      >
        <div class="mx-auto mb-4 h-1 w-12 rounded-full bg-line"></div>
        <slot></slot>
      </div>
    </div>
  </Transition>
</template>
