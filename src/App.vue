<script setup lang="ts">
import AuthScreen from './components/AuthScreen.vue';
import DesktopTrackerView from './components/DesktopTrackerView.vue';
import MobileTrackerView from './components/MobileTrackerView.vue';
import { useTimeTrackerApp } from './composables/useTimeTrackerApp';

const app = useTimeTrackerApp();
</script>

<template>
  <main
    class="min-h-screen bg-paper px-3 py-4 text-ink sm:px-5 lg:px-8"
    :class="app.editingLogId || app.detailGroup ? 'overflow-hidden pb-4 sm:pb-4' : 'pb-24 sm:pb-4'"
  >
    <AuthScreen
      v-if="!app.userId"
      :email="app.email"
      :password="app.password"
      :auth-message="app.authMessage"
      @update:email="app.email = $event"
      @update:password="app.password = $event"
      @submit="app.signIn"
    />
    <template v-else>
      <MobileTrackerView :app="app" />
      <DesktopTrackerView :app="app" />
    </template>
  </main>
</template>
