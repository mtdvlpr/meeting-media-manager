<template>
  <v-col cols="12" class="d-flex pb-0 justify-center">
    <v-col
      v-for="(day, i) in daysOfWeek"
      :key="day.formatted"
      class="text-center flex-shrink-1 px-1 pb-0"
    >
      <v-card
        :color="days[i]"
        class="fill-height d-flex justify-center flex-column"
        @click="openDate(day.formatted)"
      >
        <v-card-text class="pb-0 pt-2 text-no-wrap">
          {{ day.first }}
        </v-card-text>
        <v-card-text class="pt-0 pb-2">{{ day.second }}</v-card-text>
      </v-card>
    </v-col>
    <v-col class="pb-0 px-1">
      <v-card
        class="fill-height d-flex align-center"
        :color="recurring"
        @click="openDate('Recurring')"
      >
        <v-card-text class="text-center py-2">
          {{ $t('recurring') }}
        </v-card-text>
      </v-card>
    </v-col>
  </v-col>
</template>
<script setup lang="ts">
import type { Dayjs } from 'dayjs'
import type { DateFormat } from '~~/types'

const props = defineProps<{
  baseDate: Dayjs
  recurring: string
  days: Record<number, string>
}>()

// Open manage page for specific day
const openDate = (date: string) => {
  log.debug('Manage specific day')
  useRouter().push({
    path: useLocalePath()('/manage'),
    query: { ...useRoute().query, date },
  })
}

// Remaining days of the week
const now = getNow()
const daysOfWeek = computed(() => {
  const specialCong = getPrefs<boolean>('meeting.specialCong')
  const dateFormat = getPrefs<DateFormat>('app.outputFolderDateFormat')
  const days: { first: string; second: string; formatted: string }[] = []
  for (let i = 0; i < DAYS_IN_WEEK; i++) {
    const day = props.baseDate.add(i, 'days')
    if (day.isBefore(now)) continue

    // Add meeting day
    if (!specialCong && isMeetingDay(day)) {
      days.push({
        first: day.format('D MMM'),
        second: day.format('dddd'),
        formatted: day.format(dateFormat),
      })
    }
    // Add normal day
    else {
      days.push({
        first: day.format('D'),
        second: day.format('dd.'),
        formatted: day.format(dateFormat),
      })
    }
  }
  return days
})
</script>
