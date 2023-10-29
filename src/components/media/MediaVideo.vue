<template>
  <div :id="id" class="d-flex video-item">
    <div class="align-center d-flex">
      <video
        ref="videoPreview"
        width="142"
        height="80"
        preload="metadata"
        :poster="thumbnail || poster"
      >
        <source :src="url" />
      </video>
    </div>
    <v-overlay
      :model-value="changeTime"
      persistent
      class="d-flex align-center justify-center"
    >
      <v-sheet>
        <v-row style="max-width: 640px">
          <v-col align-self="start" class="d-flex flex-column px-0 ml-4">
            <form-timestamp
              v-model="clipped.start"
              :min="originalString.start"
              :max="clipped.end"
              @valid="validStart = $event"
            >
              <v-btn icon @click="resetClipped()">
                <v-tooltip activator="parent" location="top">
                  {{ $t('videoTimeReset') }}
                </v-tooltip>
                <v-icon icon="i-mdi:rotate-left" />
              </v-btn>
            </form-timestamp>
            <form-timestamp
              v-model="clipped.end"
              :min="clipped.start"
              :max="originalString.end"
              @valid="validEnd = $event"
            >
              <v-btn
                icon
                :disabled="!validStart || !validEnd"
                @click="setTime()"
              >
                <v-tooltip activator="parent" location="bottom">
                  {{ $t('videoTimeSet') }}
                </v-tooltip>
                <v-icon
                  icon="i-mdi:checkbox-marked"
                  :class="`text-${
                    validStart && validEnd ? 'success' : 'error'
                  }`"
                />
              </v-btn>
            </form-timestamp>
          </v-col>
        </v-row>
      </v-sheet>
    </v-overlay>
    <v-btn
      size="x-small"
      location="left"
      :rounded="0"
      variant="flat"
      color="black"
      class="time-btn"
      :class="{ 'pulse-danger': isClipped }"
      @click="atClick()"
    >
      <v-tooltip
        v-if="clickedOnce"
        activator="parent"
        location="right"
        model-value
        @update:model-value="() => {}"
      >
        {{ $t('clickAgain') }}
      </v-tooltip>
      <v-icon icon="i-mdi:movie-open" start />
      {{
        (playing || isClipped) && !isShortVideo
          ? `${progress[0] || limits.start}/${limits.end}`
          : `${duration}`
      }}
    </v-btn>
    <v-btn
      v-if="ccAvailable"
      size="x-small"
      :rounded="0"
      variant="flat"
      class="cc-btn"
      @click="ccToggle = !ccToggle"
    >
      <v-tooltip activator="parent" location="right">
        {{ $t('toggleSubtitlePosition') }}
      </v-tooltip>
      <v-icon :icon="ccIcon" />
    </v-btn>
  </div>
</template>
<script setup lang="ts">
import { pathToFileURL } from 'url'
import { basename, changeExt } from 'upath'
import type { Duration } from 'dayjs/plugin/duration'
import { pathExists } from 'fs-extra'
import { ipcRenderer, type IpcRendererEvent } from 'electron'
import { useRouteQuery } from '@vueuse/router'
import type { Time, Times, TimeString } from '~~/types'

const props = defineProps<{
  src: string
  playing?: boolean
  stream?: boolean
  tempClipped: TimeString | null
}>()
const emit = defineEmits<{
  resetClipped: []
  clipped: [time: Times]
  progress: [percentage: number]
}>()
const { $dayjs } = useNuxtApp()
const { meetings } = storeToRefs(useMediaStore())
const date = useRouteQuery<string>('date', '')
const videoPreview: { value: HTMLVideoElement | null } = ref(null)

onMounted(() => {
  setCCAvailable()
  initVideoPreview()
})

// Video properties
const isShortVideo = computed(() => duration.value === '00:00')
const id = computed(() => strip('video-' + basename(props.src)))
const poster = computed(() => (isVideo(props.src) ? VIDEO_ICON : AUDIO_ICON))
const url = computed(() => {
  return (
    (props.stream || thumbnail.value.length > 0
      ? props.src
      : pathToFileURL(props.src).href) + (thumbnail.value ? '' : '#t=5')
  )
})
const thumbnail = computed(() => {
  const meetingMedia = meetings.value.get(date.value)
  if (!meetingMedia) return ''
  let t: string | undefined
  meetingMedia.forEach((media) => {
    if (t !== undefined) return
    const file = media.find((m) => m.safeName === basename(props.src))
    if (file) {
      t = file.thumbnail || file.trackImage || ''
    }
  })
  return t ?? ''
})

// Video preview
const initVideoPreview = () => {
  if (videoPreview.value) {
    // When video has been loaded, set clipped to original
    videoPreview.value.onloadedmetadata = () => {
      original.value.end = parseInt(
        $dayjs
          .duration(videoPreview.value?.duration || 0, 's')
          .asMilliseconds()
          .toFixed(0),
      )
      clipped.value = {
        start: $dayjs
          .duration(original.value.start, 'ms')
          .format('HH:mm:ss.SSS'),
        end: $dayjs.duration(original.value.end, 'ms').format('HH:mm:ss.SSS'),
      }
      emit('clipped', {
        original: original.value,
        clipped: clippedMs.value,
        formatted: originalString.value,
      })
    }
  }
}

// Video state
const current = ref(0)
watch(
  () => props.playing,
  (val) => {
    if (val) {
      // Activate subtitles
      if (ccAvailable.value) {
        setTimeout(() => {
          toggleSubtitles(ccEnable.value, false)
        }, MS_IN_SEC)
      }
      ipcRenderer.on('videoProgress', onProgress)
    } else {
      // Reset values
      current.value = 0
      progress.value = []
      ipcRenderer.removeListener('videoProgress', onProgress)
      if (props.tempClipped) {
        resetClipped()
        emit('resetClipped')
      }
    }
  },
)

// Track video progress
const progress = ref<string[]>([])
const onProgress = (_e: IpcRendererEvent, progressArray: number[]) => {
  const percentage = (100 * MS_IN_SEC * progressArray[0]) / original.value.end
  progress.value = progressArray.map((seconds: number) => {
    return formatDuration($dayjs.duration(seconds, 's'))
  })
  if (props.playing) emit('progress', percentage)
}

// Subtitles
const ccEnable = inject(ccEnableKey, ref(false))
const ccAvailable = ref(false)
const ccToggle = ref(false)
watch(ccToggle, () => {
  if (props.playing) toggleSubtitles(ccEnable.value, true)
})
watch(
  () => ccEnable.value,
  (val) => {
    if (props.playing) toggleSubtitles(val, false)
  },
)
const ccIcon = computed(
  () => `i-mdi:closed-caption${ccEnable.value ? '' : '-outline'}`,
)
const toggleSubtitles = (enabled: boolean, toggle = false) => {
  ipcRenderer.send('toggleSubtitles', { enabled, toggle })
}
const setCCAvailable = async () => {
  ccAvailable.value =
    getPrefs<boolean>('media.enableSubtitles') &&
    (await pathExists(changeExt(props.src, 'vtt')))
}

// Custom start/end times
const validStart = ref(false)
const validEnd = ref(false)
const duration = computed(() =>
  formatDuration(
    $dayjs.duration(clippedMs.value.end - clippedMs.value.start, 'ms'),
  ),
)
const formatDuration = (duration: Duration) => {
  if (duration.hours() > 0) {
    return duration.format('HH:mm:ss')
  } else {
    return duration.format('mm:ss')
  }
}
const original = ref<Time>({
  start: 0,
  end: 0,
})
const limits = computed(() => {
  return {
    start: formatDuration($dayjs.duration(clippedMs.value.start, 'ms')),
    end: formatDuration($dayjs.duration(clippedMs.value.end, 'ms')),
  }
})
const originalString = computed(() => {
  return {
    start: $dayjs.duration(original.value.start, 'ms').format('HH:mm:ss.SSS'),
    end: $dayjs.duration(original.value.end, 'ms').format('HH:mm:ss.SSS'),
  }
})
const clipped = ref<TimeString>({
  start: '0',
  end: '0',
})
watch(
  () => props.tempClipped,
  (val) => {
    if (val) {
      clipped.value = val
      setTime()
    }
  },
)
const isClipped = computed(() => {
  return !(
    original.value.start === clippedMs.value.start &&
    original.value.end === clippedMs.value.end
  )
})
const emitClipped = () => {
  emit('clipped', {
    original: original.value,
    clipped: clippedMs.value,
    formatted: clipped.value,
  })
}
const setTime = () => {
  if (
    clippedMs.value.end < MS_IN_SEC ||
    clippedMs.value.end > original.value.end
  ) {
    resetClipped()
  } else {
    emitClipped()
  }
  changeTime.value = false
}
const resetClipped = () => {
  clipped.value = JSON.parse(JSON.stringify(originalString.value))
  emitClipped()
  changeTime.value = false
}
const clippedMs = computed(() => {
  return {
    start: parseInt(
      $dayjs
        .duration({
          hours: parseInt(clipped.value.start.split(':')[0]),
          minutes: parseInt(clipped.value.start.split(':')[1]),
          seconds: parseInt(clipped.value.start.split(':')[2]),
          milliseconds: parseInt(clipped.value.start.split('.')[1]),
        })
        .asMilliseconds()
        .toFixed(0),
    ),
    end: parseInt(
      $dayjs
        .duration({
          hours: parseInt(clipped.value.end.split(':')[0]),
          minutes: parseInt(clipped.value.end.split(':')[1]),
          seconds: parseInt(clipped.value.end.split(':')[2]),
          milliseconds: parseInt(clipped.value.end.split('.')[1]),
        })
        .asMilliseconds()
        .toFixed(0),
    ),
  }
})
const changeTime = ref(false)
const { clickedOnce, atClick } = useClickTwice(() => {
  changeTime.value = true
})
</script>
<style lang="scss" scoped>
.video-item {
  width: 142px;
  height: 80px;

  .time-btn {
    position: absolute;
    top: 4px !important;
    left: 16px !important;
    transform: unset !important;
    opacity: 60%;
  }

  .cc-btn {
    position: absolute;
    bottom: 1px;
    left: 122px !important;
  }
}
</style>
