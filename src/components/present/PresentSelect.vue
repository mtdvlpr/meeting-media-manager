<template>
  <v-row no-gutters align="start" class="present-select pa-4">
    <v-col cols="12">
      <loading-icon v-if="loading" />
      <v-list
        v-else-if="dates.length > 0"
        style="width: 100%; overflow-y: auto"
      >
        <template v-for="(date, i) in dates" :key="date">
          <v-list-item class="text-center" @click="selectDate(date)">
            <v-list-item-title>{{ date }}</v-list-item-title>
          </v-list-item>
          <v-divider v-if="i < dates.length - 1" />
        </template>
      </v-list>
      <p v-else>{{ $t('noMeetings') }}</p>
    </v-col>
  </v-row>
</template>
<script setup lang="ts">
import { basename, join } from 'upath'
import type { DateFormat } from '~~/types'

const props = defineProps<{
  firstChoice?: boolean
}>()

const loading = ref(true)
const { $dayjs } = useNuxtApp()
const today = computed(() => {
  return $dayjs().format(getPrefs<DateFormat>('app.outputFolderDateFormat'))
})

onMounted(() => {
  getDates()

  if (props.firstChoice && dates.value.length === 1) {
    selectDate(dates.value[0])
  } else if (props.firstChoice && dates.value.includes(today.value)) {
    selectDate(today.value)
  } else {
    loading.value = false
  }
})

const validDate = (date: string) => {
  return $dayjs(
    date,
    getPrefs<DateFormat>('app.outputFolderDateFormat'),
  ).isValid()
}

const selectDate = (date: string) => {
  useRouter().push({
    query: {
      ...useRoute().query,
      date,
    },
  })
}

const dates = ref<string[]>([])
const getDates = () => {
  const mPath = mediaPath()
  if (!mPath) {
    useRouter().push({
      path: useLocalePath()('/settings'),
      query: useRoute().query,
    })
    return
  }
  dates.value = findAll(join(mPath, '*'), {
    onlyDirectories: true,
    ignore: [join(mPath, 'Recurring')],
  })
    .map((path) => basename(path))
    .filter(
      (date) =>
        validDate(date) &&
        findAll(join(mPath, date, '*.!(title|vtt|json)')).length > 0,
    )
}

// Computed list height
// const windowHeight = inject(windowHeightKey, ref(0))
// const listHeight = computed(() => {
//   const OTHER_ELEMENTS = 181
//   return `max-height: ${windowHeight.value - OTHER_ELEMENTS}px`
// })
</script>
<style lang="scss" scoped>
.present-select {
  width: 100%;
}
</style>
