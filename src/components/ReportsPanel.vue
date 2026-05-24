<script setup lang="ts">
import {
  ArcElement,
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
import { Bar, Doughnut } from 'vue-chartjs';
import type { TimeTrackerAppContext } from '../composables/useTimeTrackerApp';
import { useReportsPanel } from '../composables/useReportsPanel';

ChartJS.register(CategoryScale, LinearScale, BarController, BarElement, ArcElement, Title, Tooltip, Legend);

const props = defineProps<{
  app: TimeTrackerAppContext;
  mobileHeading?: boolean;
}>();

const {
  aggregation,
  aggregationOptions,
  aggregationMenuOpen,
  aggregationMenuRef,
  activeRangeTitle,
  averageDailyTrackedLabel,
  applyAggregation,
  applyCustomRange,
  applyRangePreset,
  chartData,
  chartOptions,
  customFrom,
  customTo,
  donutData,
  donutOptions,
  hasBreakdown,
  hasData,
  hasLogs,
  openAggregationMenu,
  openPeriodMenu,
  periodMenuOpen,
  periodMenuRef,
  projectBreakdown,
  rangeBounds,
  rangeOptions,
  rangePreset,
  resolvedCustomFrom,
  resolvedCustomTo,
  selectedAggregationLabel,
  selectedPeriodButtonLabel,
  timelineEndDate,
  timelineStartDate,
  totalLabel
} = useReportsPanel(props.app);
</script>

<template>
  <section class="grid gap-2 px-3">
    <header v-if="mobileHeading">
      <h1 class="text-2xl font-medium leading-none text-ink">Reports</h1>
    </header>
    <div class="rounded-lg bg-transparent py-2">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-sm font-normal text-stone-300">{{ activeRangeTitle }}</h2>
          <p class="text-xs font-normal text-stone-400">{{ selectedAggregationLabel }}</p>
        </div>

        <div class="grid w-full grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-3 sm:w-auto sm:grid-cols-[minmax(0,19rem)_minmax(0,12rem)]">
          <div ref="periodMenuRef" class="relative">
            <button
              class="inline-flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-line bg-panel px-3 text-left text-sm text-ink transition hover:border-sage"
              type="button"
              :aria-expanded="periodMenuOpen"
              aria-controls="report-period-panel"
              @click="openPeriodMenu"
            >
              <span class="truncate">{{ selectedPeriodButtonLabel }}</span>
              <ChevronDown :size="16" class="shrink-0 transition" :class="periodMenuOpen ? 'rotate-180' : ''" />
            </button>
            <div
              v-if="periodMenuOpen"
              id="report-period-panel"
              class="absolute left-0 top-full z-20 mt-2 grid w-full gap-1 rounded-lg border border-line bg-panel p-2 shadow-soft"
            >
              <button
                v-for="option in rangeOptions.filter((option) => option.value !== 'custom')"
                :key="option.value"
                class="rounded-lg px-3 py-2 text-left text-sm text-ink transition hover:bg-white/5"
                :class="rangePreset === option.value ? 'bg-white/10' : ''"
                type="button"
                @click="applyRangePreset(option.value)"
              >
                {{ option.label }}
              </button>

              <label class="mt-2 grid gap-1 rounded-lg border border-line/80 bg-black/10 px-3 py-2 text-sm font-normal text-stone-300">
                <span>From</span>
                <input v-model="customFrom" class="min-h-11 rounded-lg border border-line bg-panel px-3 text-ink" :min="timelineStartDate || undefined" :max="resolvedCustomTo || undefined" type="date" />
              </label>

              <label class="grid gap-1 rounded-lg border border-line/80 bg-black/10 px-3 py-2 text-sm font-normal text-stone-300">
                <span>To</span>
                <input v-model="customTo" class="min-h-11 rounded-lg border border-line bg-panel px-3 text-ink" :min="resolvedCustomFrom || undefined" :max="timelineEndDate || undefined" type="date" />
              </label>

              <button
                class="btn-primary mt-2 inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-medium"
                type="button"
                @click="applyCustomRange"
              >
                Done
              </button>
            </div>
          </div>

          <div ref="aggregationMenuRef" class="relative">
            <button
              class="inline-flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-line bg-panel px-3 text-left text-sm text-ink transition hover:border-sage"
              type="button"
              :aria-expanded="aggregationMenuOpen"
              aria-controls="report-aggregation-panel"
              @click="openAggregationMenu"
            >
              <span class="truncate">{{ selectedAggregationLabel }}</span>
              <ChevronDown :size="16" class="shrink-0 transition" :class="aggregationMenuOpen ? 'rotate-180' : ''" />
            </button>
            <div
              v-if="aggregationMenuOpen"
              id="report-aggregation-panel"
              class="absolute right-0 top-full z-20 mt-2 grid w-full gap-1 rounded-lg border border-line bg-panel p-2 shadow-soft"
            >
              <button
                v-for="option in aggregationOptions"
                :key="option.value"
                class="rounded-lg px-3 py-2 text-left text-sm text-ink transition hover:bg-white/5"
                :class="aggregation === option.value ? 'bg-white/10' : ''"
                type="button"
                @click="applyAggregation(option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>

    <div class="flex items-baseline justify-between gap-3 rounded-lg bg-transparent py-1">
      <p class="text-xs font-normal text-stone-500">Average daily tracked duration</p>
      <p class="text-lg font-medium text-ink">{{ averageDailyTrackedLabel }}</p>
    </div>

    <div class="rounded-lg bg-transparent py-2">
      <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
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

      <div v-if="hasBreakdown" class="mt-4 grid gap-3 pt-3 lg:grid-cols-[minmax(0,18rem)_1fr] lg:items-center">
        <div class="mx-auto h-64 w-full max-w-[18rem]">
          <Doughnut :data="donutData" :options="donutOptions" />
        </div>
        <div class="grid gap-2">
          <div
            v-for="segment in projectBreakdown"
            :key="segment.projectId"
            class="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 rounded-lg bg-black/10 px-3 py-2"
          >
            <span class="h-3 w-3 rounded-full border border-black/10" :style="{ backgroundColor: segment.color }"></span>
            <span class="truncate text-sm font-medium text-ink">{{ segment.projectName }}</span>
            <span class="text-xs font-normal text-stone-300">{{ app.formatDurationMs(segment.ms) }}</span>
            <span class="text-xs font-normal text-stone-400">{{ Math.round(segment.share * 100) }}%</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
