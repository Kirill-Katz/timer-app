<script setup lang="ts">
withDefaults(defineProps<{
  show: boolean;
  zClass?: string;
  contentClass?: string;
}>(), {
  zClass: 'z-[60]',
  contentClass: 'px-4 py-5'
});

const emit = defineEmits<{
  scroll: [event: Event];
}>();
</script>

<template>
  <Transition enter-active-class="transition duration-0 ease-linear" enter-from-class="opacity-100 translate-y-0" enter-to-class="opacity-100 translate-y-0" leave-active-class="transition duration-0 ease-linear" leave-from-class="opacity-100 translate-y-0" leave-to-class="opacity-100 translate-y-0">
    <section v-if="show" class="fixed inset-0 overflow-y-auto overscroll-contain bg-paper" :class="[zClass, contentClass]" @scroll.passive="emit('scroll', $event)">
      <slot></slot>
    </section>
  </Transition>
</template>
