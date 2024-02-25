<template>
  <v-form ref="meetingForm" v-model="valid">
    <input-field
      id="meeting.specialCong"
      v-model="meeting.specialCong"
      field="switch"
      :label="$t('specialCong')"
    />
    <template v-if="!meeting.specialCong">
      <input-field
        v-for="m in meetingKeys"
        :id="`meeting.${m.day}`"
        :key="m.day"
        v-model="meeting[m.day]"
        field="btn-group"
        :group-label="`${m.day.slice(0, 2)}MeetingDay`"
        :group-items="localeDays"
        height="56px"
        :mandatory="meeting[m.day] !== null"
        required
      >
        <input-time
          :id="`meeting.${m.time}`"
          v-model="meeting[m.time]"
          required
        />
      </input-field>
      <input-date
        id="meeting.coWeek"
        v-model="meeting.coWeek"
        :label="$t('coWeek')"
        :min="$dayjs().startOf('week').format('YYYY-MM-DD')"
        :allowed-dates="isTuesday"
        :explanation="$t('coWeekExplain')"
        :format="prefs.app.outputFolderDateFormat"
      />
    </template>
    <v-divider :class="{ 'mb-6': true, 'mt-6': !meeting.specialCong }" />
    <v-col class="d-flex pa-0 pb-2 align-center justify-space-between">
      <input-field
        id="meeting.enableMusicButton"
        v-model="meeting.enableMusicButton"
        field="switch"
        :label="$t('enableMusicButton')"
        class="mr-4 mb-2"
      />
      <v-tooltip
        location="top"
        :text="
          $t(
            status == 'success'
              ? 'shuffleMusicDownloaded'
              : 'downloadShuffleMusic',
          )
        "
      >
        <template #activator="{ props: btnProps }">
          <v-btn
            v-if="meeting.enableMusicButton"
            v-bind="btnProps"
            icon="i-mdi:playlist-music"
            :loading="status === 'loading'"
            :disabled="!appOnline"
            :color="
              status ? (status === 'loading' ? 'primary' : status) : 'primary'
            "
            @click="downloadShuffleMusic()"
          />
        </template>
      </v-tooltip>
    </v-col>
    <template v-if="meeting.enableMusicButton">
      <input-field
        id="meeting.shuffleShortcut"
        v-model="meeting.shuffleShortcut"
        placeholder="e.g. Alt+K"
        :label="$t('shuffleShortcut')"
        required
        :rules="getShortcutRules('toggleMusicShuffle')"
      />
      <input-field
        id="meeting.musicVolume"
        v-model="meeting.musicVolume"
        field="slider"
        :group-label="$t('musicVolume')"
        label-suffix="%"
        :min="1"
        :max="100"
      />
      <input-field
        id="meeting.autoStartMusic"
        v-model="meeting.autoStartMusic"
        field="switch"
        :label="$t('autoStartMusic')"
      />
      <input-field
        id="meeting.enableMusicFadeOut"
        v-model="meeting.enableMusicFadeOut"
        field="switch"
        :label="$t('musicFadeOutType')"
      />
      <v-row
        v-if="meeting.enableMusicFadeOut"
        class="mb-4"
        justify="space-between"
      >
        <v-col align-self="center" class="text-left">
          <v-slider
            id="meeting.musicFadeOutTime"
            v-model="meeting.musicFadeOutTime"
            :disabled="isLocked('meeting.musicFadeOutTime')"
            :min="5"
            :max="60"
            :step="5"
          />
        </v-col>
        <v-col cols="auto" align-self="center" class="text-right">
          <v-btn-toggle
            id="meeting.musicFadeOutType"
            v-model="meeting.musicFadeOutType"
            variant="outlined"
            mandatory
          >
            <v-btn
              value="smart"
              :disabled="isLocked('meeting.musicFadeOutType')"
            >
              {{ musicFadeOutSmart }}
            </v-btn>
            <v-btn
              value="timer"
              :disabled="isLocked('meeting.musicFadeOutType')"
            >
              {{ musicFadeOutTimer }}
            </v-btn>
          </v-btn-toggle>
        </v-col>
      </v-row>
    </template>
  </v-form>
</template>
<script setup lang="ts">
import { ensureDir, readdir } from 'fs-extra'
import { extname, join } from 'upath'
import type { MeetingPrefs, PrefStore, VFormRef, VideoFile } from '~~/types'

const props = defineProps<{
  prefs: PrefStore
  cache: number
}>()
const emit = defineEmits<{
  cache: []
  valid: [valid: boolean]
  refresh: [prefs: MeetingPrefs]
}>()

const { $dayjs } = useNuxtApp()
const { appOnline } = useOnline()
const meetingForm = ref<VFormRef | null>()
const { prefs: meeting } = usePrefs<MeetingPrefs>('meeting', emit)
const isTuesday = (date: Date) => $dayjs(date).day() === 2
const meetingKeys: { day: keyof MeetingPrefs; time: keyof MeetingPrefs }[] = [
  { day: 'mwDay', time: 'mwStartTime' },
  { day: 'weDay', time: 'weStartTime' },
]

const localeDays = computed(() => {
  return $dayjs.weekdaysMin(true).map((day, i) => {
    return {
      title: day,
      value: i,
    }
  })
})

onMounted(() => {
  // Validate coWeek
  if (meeting.value.coWeek) {
    const date = $dayjs(meeting.value.coWeek, 'YYYY-MM-DD')
    if (!date.isValid() || date.isBefore($dayjs().startOf('week'))) {
      meeting.value.coWeek = null
    }
  }

  setShuffleMusicCached()
  if (meetingForm.value) meetingForm.value.validate()
})

// Form validation
const valid = ref(true)
const meetingDaysValid = computed(() => {
  return (
    meeting.value.specialCong ||
    (meeting.value.mwDay !== null &&
      meeting.value.weDay !== null &&
      !!meeting.value.mwStartTime &&
      !!meeting.value.weStartTime)
  )
})

watch(valid, (val) => {
  emit('valid', val && meetingDaysValid.value)
})

watch(meetingDaysValid, (val) => {
  emit('valid', valid.value && val)
})

// Cache
watch(
  () => props.cache,
  () => {
    setShuffleMusicCached()
  },
)
const setShuffleMusicCached = async () => {
  let matchingFiles = 0
  try {
    const pPath = pubPath()
    if (!pPath || !props.prefs.media.lang) return false
    const isSign = isSignLanguage()
    const langDir = isSign ? props.prefs.media.lang : 'E'
    const pubCode = isSign ? 'sjj' : 'sjjm'
    const ext = isSign ? '.mp4' : '.mp3'
    const shuffleCacheDir = join(pPath, '..', langDir, pubCode)
    await ensureDir(shuffleCacheDir)
    const folders = await readdir(shuffleCacheDir)
    matchingFiles = folders.filter((file) => file.endsWith(ext)).length
  } catch (e) {
    log.error(e)
  }
  cached.value = matchingFiles === NR_OF_KINGDOM_SONGS
}
const cached = ref(false)
watch(cached, (val) => {
  if (val) {
    status.value = 'success'
  } else if (status.value === 'success') {
    status.value = ''
  }
})

// Background music
watch(
  () => meeting.value.enableMusicButton,
  (val) => {
    meetingForm.value?.validate()
    useStatStore().showMusicButton = val
  },
)
const isSignLanguage = () => useMediaStore().mediaLang?.isSignLanguage
const musicFadeOutSmart = useComputedLabel<MeetingPrefs>(
  'musicFadeOutSmart',
  meeting,
  'musicFadeOutTime',
  DEFAULT_PREFS.meeting.musicFadeOutTime,
)

const musicFadeOutTimer = useComputedLabel<MeetingPrefs>(
  'musicFadeOutTimer',
  meeting,
  'musicFadeOutTime',
  DEFAULT_PREFS.meeting.musicFadeOutTime,
)

const processed = ref(0)
const setProgress = inject(setProgressKey, () => {})
const downloadSong = async (song: VideoFile) => {
  await downloadIfRequired({ file: song })
  setProgress(++processed.value, NR_OF_KINGDOM_SONGS, true)
}

const status = ref('')
const downloadShuffleMusic = async () => {
  status.value = 'loading'
  if (!props.prefs.media.lang) {
    status.value = 'error'
    return
  }

  const isSign = isSignLanguage()

  try {
    const songs = (await getMediaLinks({
      pubSymbol: isSign ? 'sjj' : 'sjjm',
      format: isSign ? 'MP4' : 'MP3',
      lang: isSign ? props.prefs.media.lang : 'E',
    })) as VideoFile[]

    const promises: Promise<void>[] = []

    songs
      .filter((item) => extname(item.url) === (isSign ? '.mp4' : '.mp3'))
      .forEach((s) => promises.push(downloadSong(s)))

    await Promise.allSettled(promises)
    status.value = 'success'
    emit('cache')
  } catch (e: unknown) {
    status.value = 'error'
  }
}
</script>
