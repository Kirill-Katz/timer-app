<script setup lang="ts">
import { Circle, LogOut, Wifi, WifiOff } from 'lucide-vue-next';
import type { TimeTrackerAppContext } from '../composables/useTimeTrackerApp';

defineProps<{
  app: TimeTrackerAppContext;
  mobile?: boolean;
}>();
</script>

<template>
  <div class="grid gap-3">
    <div class="rounded-lg border border-line bg-panel p-3">
      <div class="flex items-center justify-between gap-3">
        <span class="font-normal">Connection</span>
        <span class="inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm font-normal" :class="app.syncState.online ? 'border-line bg-panel' : 'border-red-900/70 bg-red-950/70 text-red-100'">
          <Wifi v-if="app.syncState.online" :size="16" />
          <WifiOff v-else :size="16" />
          {{ app.syncState.online ? 'Online' : 'Offline' }}
        </span>
      </div>
    </div>
    <div class="rounded-lg border border-line bg-panel p-3">
      <div class="flex items-center justify-between gap-3">
        <span class="font-normal">Pending operations</span>
        <span class="inline-flex min-h-9 items-center gap-2 rounded-full border border-line bg-panel px-3 text-sm font-normal">
          <Circle :size="12" :fill="app.syncState.pendingCount ? '#c7792b' : '#4f8f6b'" />
          {{ app.syncState.pendingCount }}
        </span>
      </div>
    </div>
    <div class="rounded-lg border border-line bg-panel p-3">
      <div class="flex items-center justify-between gap-3">
        <span class="font-normal">Sync</span>
        <span class="rounded-full border border-line bg-panel px-3 py-2 text-sm font-normal">{{ app.syncState.syncing ? 'Syncing' : 'Idle' }}</span>
      </div>
      <button
        v-if="mobile"
        class="btn-primary mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 font-normal"
        type="button"
        :disabled="!app.syncState.online"
        @click="app.synchronizeFromRemote"
      >
        Synchronize
      </button>
      <p v-if="app.syncState.lastError" class="mt-3 rounded-lg bg-red-700 px-3 py-2 text-sm font-normal text-white">{{ app.syncState.lastError }}</p>
    </div>
    <button class="btn-danger mt-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 font-normal" type="button" @click="app.signOut">
      <LogOut :size="18" /> Sign out
    </button>
  </div>
</template>
