<template>
  <div>
    <action-preview
      v-if="action"
      :text="text(action)"
      :icon="icon(action)"
      @abort="action = ''"
      @perform="execute(action)"
    />
    <v-app-bar>
      <v-app-bar-title>{{ $t('plannedMedia') }}</v-app-bar-title>
      <progress-bar
        :current="relativeDownloadProgress"
        :total="totalProgress"
      />
      <template #extension>
        <v-tabs v-model="currentWeek" grow>
          <v-tab v-for="w in upcomingWeeks" :key="w.iso" :value="w.iso">
            {{ w.label }}
          </v-tab>
        </v-tabs>
      </template>
    </v-app-bar>
    <v-row no-gutters justify="center" class="pa-4">
      <v-window v-model="currentWeek">
        <v-window-item v-for="w in upcomingWeeks" :key="w.iso" :value="w.iso">
          <v-col cols="12">
            <home-week-tiles
              :base-date="baseDate"
              :day-colors="dayColors"
              :recurring-color="recurringColor"
            />
            <home-feature-tiles
              :jw="jwSyncColor"
              :cong="congSyncColor"
              :mp4="mp4Color"
            />
          </v-col>
        </v-window-item>
      </v-window>
      <v-col cols="12" class="text-center">
        <v-btn
          color="primary"
          :disabled="!online"
          :loading="loading"
          size="large"
          @click="startMediaSync()"
        >
          {{ $t('fetchMedia') }}
        </v-btn>
        <v-btn
          v-if="isDev"
          color="warning"
          :disabled="!online"
          :loading="loading"
          class="ml-2"
          @click="testApp()"
        >
          Test App
        </v-btn>
      </v-col>
    </v-row>
  </div>
</template>
<script setup lang="ts">
import { fileURLToPath, pathToFileURL } from 'url'
import { useIpcRenderer } from '@vueuse/electron'
import { existsSync } from 'fs-extra'
import { basename, join } from 'upath'
import type { AppPrefs, MediaPrefs, MeetingPrefs } from '~~/types'

useHead({ title: 'Home' })
const { $dayjs } = useNuxtApp()
const { isDev } = useRuntimeConfig().public
const { online } = useOnline()
// const shuffleEnabled = getPrefs<boolean>('meeting.enableMusicButton')
// const presentModeEnabled = getPrefs<boolean>('media.enableMediaDisplayButton')

const statStore = useStatStore()
const { initialLoad } = storeToRefs(statStore)
onMounted(() => {
  getJWLangs()
  useNotifyStore().dismissByMessage('cantCloseMediaWindowOpen')

  // Open settings when invalid
  if (!mediaPath()) {
    log.debug('Open settings to fill in mediaLang/localOutputFolder')
    useRouter().push({
      path: useLocalePath()('/settings'),
      query: useRoute().query,
    })
    return
  }
  setMeetingColors()
  loading.value = false
  if (initialLoad.value) {
    autoStartMusic()
  }
  if (initialLoad.value && getPrefs<boolean>('app.autoStartSync')) {
    action.value = 'startMediaSync'
  }
  statStore.setInitialLoad(false)
})

// Dates
const now = getNow()
const currentWeek = useNumberQuery('week', $dayjs().isoWeek())
const {
  baseDate,
  mwDay,
  mwDayObject,
  mwFormatted,
  weDay,
  weDayObject,
  weFormatted,
} = useMeetingDays(currentWeek)
watch(currentWeek, () => {
  resetColors()
})

const weekLength = computed(() => {
  let days = 0
  for (let i = 0; i < DAYS_IN_WEEK; i++) {
    const day = baseDate.value.add(i, 'days')
    if (day.isBefore(now)) {
      continue
    }
    days++
  }
  return days
})

const upcomingWeeks = computed(() => {
  const weeks: { iso: number; label: string }[] = []
  const dateFormat = getPrefs<string>('app.outputFolderDateFormat')
  if (!dateFormat) {
    return []
  }

  for (let i = 0; i < 5; i++) {
    const week = $dayjs().add(i, 'weeks')
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
    weeks.push({ iso, label })
  }

  return weeks
})

// Colors
const defaultColor = 'secondary'
const defaultDayColor = 'accent'
const jwSyncColor = ref(defaultColor)
const congSyncColor = ref(defaultColor)
const recurringColor = ref(defaultColor)
const mp4Color = ref(defaultColor)
const dayColors = ref<Record<number, string>>({
  0: defaultDayColor,
  1: defaultDayColor,
  2: defaultDayColor,
  3: defaultDayColor,
  4: defaultDayColor,
  5: defaultDayColor,
  6: defaultDayColor,
})

const setDayColor = (day: number, color: string) => {
  dayColors.value[weekLength.value + day - DAYS_IN_WEEK] = color
}

const setMeetingColors = () => {
  if (getPrefs<boolean>('meeting.specialCong')) {
    return
  }
  setDayColor(mwDay.value, 'secondary')
  setDayColor(weDay, 'secondary')
}

const resetColors = () => {
  jwSyncColor.value =
    congSyncColor.value =
    recurringColor.value =
    mp4Color.value =
      defaultColor

  for (const key in dayColors.value) {
    dayColors.value[key] = defaultDayColor

    setMeetingColors()
  }
}

// Media sync
const loading = ref(true)
const { client } = useCongStore()
const congSync = computed(() => !!client)
const mediaStore = useMediaStore()
const { mediaLang, fallbackLang } = storeToRefs(mediaStore)
const startMediaSync = async (dryrun = false) => {
  const mPath = mediaPath()
  if (!mPath) return

  if (!online.value) {
    warn('errorOffline')
    return
  }
  useNotifyStore().dismissByMessage('dontForgetToGetMedia')
  loading.value = true
  statStore.startPerf({ func: 'total', start: performance.now() })

  try {
    if (!dryrun) {
      rm(
        findAll(join(mPath, '*'), {
          ignore: [join(mPath, 'Recurring')],
          onlyDirectories: true,
        }).filter((dir: string) => {
          const date = $dayjs(
            basename(dir),
            getPrefs<string>('app.outputFolderDateFormat'),
          )
          return !date.isValid() || date.isBefore(now)
        }),
      )
    }

    const { specialCong } = getPrefs<MeetingPrefs>('meeting')

    if (!specialCong) {
      statStore.startPerf({ func: 'getJwOrgMedia', start: performance.now() })
      await Promise.allSettled([getMidweekMedia(), getWeekendMedia()])
      statStore.stopPerf({ func: 'getJwOrgMedia', stop: performance.now() })
    }

    createMediaNames()

    if (congSync.value) {
      try {
        congSyncColor.value = 'warning'
        getCongMedia(baseDate.value, now)
        if (dryrun) {
          congSyncColor.value = 'success'
        }
      } catch (e) {
        error('errorGetCongMedia', e)
        congSyncColor.value = 'error'
      }
    }

    if (!dryrun) {
      await Promise.allSettled([
        syncCongServerMedia(),
        syncLocalRecurring(),
        syncJWorgMedia(dryrun),
      ])
    }

    await convertUnusableFiles(mPath, setProgress)

    const { enableMp4Conversion, enableVlcPlaylistCreation } =
      getPrefs<MediaPrefs>('media')

    if (enableMp4Conversion) {
      statStore.startPerf({ func: 'convertMP4', start: performance.now() })
      mp4Color.value = 'warning'
      try {
        await convertToMP4(baseDate.value, now, setProgress)
        mp4Color.value = 'success'
      } catch (e: unknown) {
        log.error(e)
        mp4Color.value = 'error'
      }
      statStore.stopPerf({ func: 'convertMP4', stop: performance.now() })
    }

    if (enableVlcPlaylistCreation) {
      convertToVLC()
    }

    const { autoOpenFolderWhenDone, autoQuitWhenDone } =
      getPrefs<AppPrefs>('app')

    if (autoOpenFolderWhenDone) {
      try {
        useIpcRenderer().send(
          'openPath',
          fileURLToPath(pathToFileURL(mPath).href),
        )
      } catch (e: unknown) {
        warn('errorSetVars', { identifier: mPath }, e)
      }
    }

    statStore.stopPerf({ func: 'total', stop: performance.now() })
    statStore.printStats()
    if (autoQuitWhenDone) {
      action.value = 'quitApp'
    }
  } catch (e) {
    error('errorUnknown', e)
  } finally {
    loading.value = false
    statStore.clearPerf()
    statStore.clearDownloads()
    mediaStore.clearProgress()
  }
}

const { totalProgress, setProgress, relativeDownloadProgress } = useProgress()
const syncJWorgMedia = async (dryrun = false) => {
  statStore.startPerf({ func: 'syncJWorgMedia', start: performance.now() })
  jwSyncColor.value = 'warning'

  try {
    await syncJWMedia(dryrun, baseDate.value, setProgress)
    jwSyncColor.value = 'success'
  } catch (e) {
    log.error(e)
    jwSyncColor.value = 'error'
  }

  statStore.stopPerf({ func: 'syncJWorgMedia', stop: performance.now() })
}

const getMidweekMedia = async () => {
  const mwbAvailable = mediaLang.value?.mwbAvailable !== false
  const mwbFallbackAvailable =
    fallbackLang.value && fallbackLang.value.mwbAvailable !== false
  if (!mwbAvailable && !mwbFallbackAvailable) {
    warn('errorMwbUnavailable')
    setDayColor(mwDay.value, 'error')
    return
  }

  if (now.isSameOrBefore(mwDayObject.value)) {
    setDayColor(mwDay.value, 'warning')
    try {
      await getMwMedia(mwFormatted.value)
      setDayColor(mwDay.value, 'success')
    } catch (e) {
      error('errorGetMwMedia', e)
      setDayColor(mwDay.value, 'error')
    }
  }
}

const getWeekendMedia = async () => {
  const wAvailable = mediaLang.value?.wAvailable !== false
  const wFallbackAvailable =
    fallbackLang.value && fallbackLang.value.wAvailable !== false
  if (!wAvailable && !wFallbackAvailable) {
    warn('errorWUnavailable')
    setDayColor(weDay, 'error')
  }

  if (now.isSameOrBefore(weDayObject.value)) {
    setDayColor(weDay, 'warning')
    try {
      await getWeMedia(weFormatted.value)
      setDayColor(weDay, 'success')
    } catch (e) {
      error('errorGetWeMedia', e)
      setDayColor(weDay, 'error')
    }
  }
}

const syncCongServerMedia = async () => {
  if (!congSync.value) {
    return
  }

  try {
    await syncCongMedia(baseDate.value, setProgress)
    if (congSyncColor.value === 'warning') {
      congSyncColor.value = 'success'
    }
  } catch (e) {
    congSyncColor.value = 'error'
    error('errorSyncCongMedia', e)
  }
}

const syncLocalRecurring = async () => {
  try {
    recurringColor.value = 'warning'
    if (!congSync.value && existsSync(join(mediaPath(), 'Recurring'))) {
      syncLocalRecurringMedia(baseDate.value)
    }
    recurringColor.value = 'success'
  } catch (e) {
    log.error(e)
    recurringColor.value = 'error'
  }
}

// Perform automatic actions
const action = ref('')
const icon = (action: string) => {
  switch (action) {
    case 'quitApp':
      return 'i-mdi:exit-run'
    case 'startMediaSync':
      return 'i-mdi:pause'
    default:
      throw new Error(`Unknown action: ${action}`)
  }
}
const text = (action: string) => {
  switch (action) {
    case 'quitApp':
      return 'autoQuitWhenDone'
    case 'startMediaSync':
      return 'autoStartSync'
    default:
      throw new Error(`Unknown action: ${action}`)
  }
}
const execute = (ac: string) => {
  action.value = ''
  switch (ac) {
    case 'startMediaSync':
      startMediaSync()
      break
    case 'quitApp':
      useIpcRenderer().send('exit')
      break
    default:
      throw new Error('Unknown action')
  }
}

const testApp = async () => {
  const dbStore = useDbStore()
  const previousLang = cloneDeep(getPrefs<string>('media.lang'))
  /*
      AML: American Sign Language
      E: English
      F: French
      O: Dutch
      M: Romanian
      R: Armenian (West)
      S: Spanish
      T: Portuguese (Brazil)
      U: Russian
      X: German
      */
  const testLangs = ['AML', 'E', 'F', 'M', 'O', 'R', 'S', 'T', 'U', 'X']
  for (const lang of testLangs) {
    setPrefs('media.lang', lang)
    dbStore.clear()
    mediaStore.clear()
    await startMediaSync(true)
  }
  setPrefs('media.lang', previousLang)
  dbStore.clear()
  mediaStore.clear()
  if (!testLangs.includes(previousLang)) {
    await startMediaSync(true)
  }
}
</script>
