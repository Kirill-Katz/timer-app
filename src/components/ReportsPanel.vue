<script setup lang="ts">
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Title,
  Tooltip
} from 'chart.js';
import { ChevronDown } from 'lucide-vue-next';
import { Bar } from 'vue-chartjs';
import type { TimeTrackerAppContext } from '../composables/useTimeTrackerApp';
import { useReportsPanel } from '../composables/useReportsPanel';

ChartJS.register(CategoryScale, LinearScale, BarController, BarElement, Title, Tooltip, Legend);

const props = defineProps<{
  app: TimeTrackerAppContext;
}>();

const {
  aggregation,
  aggregationOptions,
  activeRangeTitle,
  chartData,
  chartOptions,
  controlsOpen,
  controlsRef,
  controlsSummary,
  customFrom,
  customTo,
  hasData,
  hasLogs,
  rangeBounds,
  rangeOptions,
  rangePreset,
  resolvedCustomFrom,
  resolvedCustomTo,
  selectedAggregationLabel,
  timelineEndDate,
  timelineStartDate,
  totalLabel
} = useReportsPanel(props.app);
</script>

<template>
  <section class="grid gap-4">
    <div class="rounded-lg border border-line bg-panel p-3 shadow-soft">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-lg font-medium text-ink">{{ activeRangeTitle }}</h2>
          <p class="text-sm text-stone-300">{{ selectedAggregationLabel }}</p>
        </div>

        <div ref="controlsRef" class="relative w-full sm:w-auto">
          <button
            class="inline-flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-line bg-panel px-3 text-left text-sm text-ink transition hover:border-sage sm:min-w-72"
            type="button"
            :aria-expanded="controlsOpen"
            aria-controls="report-settings-panel"
            @click="controlsOpen = !controlsOpen"
          >
            <span>{{ controlsSummary }}</span>
            <ChevronDown :size="16" class="shrink-0 transition" :class="controlsOpen ? 'rotate-180' : ''" />
          </button>
          <div
            v-if="controlsOpen"
            id="report-settings-panel"
            class="absolute right-0 top-full z-20 mt-2 grid w-full gap-3 rounded-lg border border-line bg-panel p-3 shadow-soft sm:w-80"
          >
            <label class="grid gap-1 text-sm font-normal text-stone-300">
              Aggregation
              <select v-model="aggregation" class="min-h-11 rounded-lg border border-line bg-panel px-3 text-ink">
                <option v-for="option in aggregationOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </label>

            <label class="grid gap-1 text-sm font-normal text-stone-300">
              Period
              <select v-model="rangePreset" class="min-h-11 rounded-lg border border-line bg-panel px-3 text-ink">
                <option v-for="option in rangeOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </label>

            <div v-if="rangePreset === 'custom'" class="grid gap-2">
              <label class="grid gap-1 text-sm font-normal text-stone-300">
                From
                <input v-model="customFrom" class="min-h-11 rounded-lg border border-line bg-panel px-3 text-ink" :min="timelineStartDate || undefined" :max="resolvedCustomTo || undefined" type="date" />
              </label>
              <label class="grid gap-1 text-sm font-normal text-stone-300">
                To
                <input v-model="customTo" class="min-h-11 rounded-lg border border-line bg-panel px-3 text-ink" :min="resolvedCustomFrom || undefined" :max="timelineEndDate || undefined" type="date" />
              </label>
            </div>
          </div>
        </div>
      </div>

    </div>

    <div class="rounded-lg border border-line bg-panel p-3 shadow-soft">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 class="text-lg font-medium">Tracked Time</h3>
          <p class="text-sm text-stone-300">Total: {{ totalLabel }}</p>
        </div>
      </div>

      <div v-if="!hasLogs" class="flex min-h-72 items-center justify-center rounded-lg border border-dashed border-line text-sm text-stone-400">
        No time logs yet.
      </div>
      <div v-else-if="!rangeBounds" class="flex min-h-72 items-center justify-center rounded-lg border border-dashed border-line text-sm text-stone-400">
        Select a valid date range.
      </div>
      <div v-else-if="!hasData" class="flex min-h-72 items-center justify-center rounded-lg border border-dashed border-line text-sm text-stone-400">
        No buckets available for the selected range.
      </div>
      <div v-else class="h-72 sm:h-80">
        <Bar :data="chartData" :options="chartOptions" />
      </div>
    </div>
  </section>
</template>
