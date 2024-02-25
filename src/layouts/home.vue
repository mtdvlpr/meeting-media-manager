<template>
  <base-layout>
    <template #top>
      <v-app-bar>
        <v-app-bar-title>{{ $t('plannedMedia') }}</v-app-bar-title>
        <progress-bar
          :current="relativeDownloadProgress"
          :total="totalProgress"
        />
        <template #extension>
          <v-tabs v-model="currentWeek">
            <v-tab
              v-for="w in upcomingWeeks"
              :key="w.iso"
              :value="w.iso"
              :text="w.label"
            />
          </v-tabs>
        </template>
      </v-app-bar>
    </template>
    <slot />
  </base-layout>
</template>
<script setup lang="ts">
const { totalProgress, setProgress, relativeDownloadProgress } = useProgress()
provide(setProgressKey, setProgress)

// Dates
const dayjs = useDayjs()
const currentWeek = useNumberQuery('week', dayjs().isoWeek())
provide(currentWeekKey, currentWeek)

const upcomingWeeks = computed(() => {
  const weeks: { iso: number; label: string }[] = []
  const dateFormat = getPrefs<string>('app.outputFolderDateFormat')
  if (!dateFormat) {
    return []
  }

  for (let i = 0; i < 5; i++) {
    const week = dayjs().add(i, 'weeks')
    const iso = week.isoWeek()
    const label =
      week
        .startOf('week')
        .format(
          `D${
            week.startOf('week').month() !== week.endOf('week').month()
              ? ' MMM'
              : ''
          }`,
        ) + ` - ${week.endOf('week').format('D MMM')}`
    weeks.push({ label, iso })
  }

  return weeks
})
provide(upcomingWeeksKey, upcomingWeeks)
</script>
