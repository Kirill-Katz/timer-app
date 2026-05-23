<script setup lang="ts">
import { Check } from 'lucide-vue-next';

const props = defineProps<{
  email: string;
  password: string;
  authMessage: string;
}>();

const emit = defineEmits<{
  'update:email': [value: string];
  'update:password': [value: string];
  submit: [];
}>();
</script>

<template>
  <section class="mx-auto mt-[12vh] grid max-w-xl gap-4 rounded-lg border border-line bg-panel p-4 shadow-soft sm:p-5">
    <div class="grid gap-2">
      <h2 class="text-2xl font-black">Sign in</h2>
      <p class="text-sm leading-6 text-stone-300">Use your Supabase account so RLS can protect your tracker data.</p>
    </div>
    <form class="grid gap-2" @submit.prevent="emit('submit')">
      <input
        :value="props.email"
        class="min-h-12 rounded-lg border border-line bg-panel px-3 text-ink placeholder:text-stone-500"
        type="email"
        placeholder="you@example.com"
        autocomplete="email"
        @input="emit('update:email', ($event.target as HTMLInputElement).value)"
      />
      <input
        :value="props.password"
        class="min-h-12 rounded-lg border border-line bg-panel px-3 text-ink placeholder:text-stone-500"
        type="password"
        placeholder="Password"
        autocomplete="current-password"
        @input="emit('update:password', ($event.target as HTMLInputElement).value)"
      />
      <button class="btn-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-4 font-bold" type="submit">
        <Check :size="18" /> Sign in
      </button>
    </form>
    <p v-if="props.authMessage" class="text-sm text-stone-300">{{ props.authMessage }}</p>
  </section>
</template>
