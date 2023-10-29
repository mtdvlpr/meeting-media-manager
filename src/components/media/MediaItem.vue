<template>
  <v-list-item
    :id="id"
    :data-id="id"
    link
    :class="{
      'media-item': true,
      'media-played': played,
      'current-media-item': current,
    }"
  >
    <template #prepend>
      <div v-if="isImage(src)" class="img-container">
        <img
          ref="imgPreview"
          class="img-preview"
          :src="url"
          @click="atClick"
          @wheel.prevent="zoomWithWheel"
        />
      </div>
      <media-video
        v-else
        :src="!!streamingFile && streamDownloaded ? localStreamPath : src"
        :playing="active"
        :stream="!!streamingFile && !streamDownloaded"
        :temp-clipped="tempClipped"
        @clipped="setTime($event)"
        @reset-clipped="tempClipped = null"
        @progress="progress = $event"
      />
    </template>
    <v-list-item-subtitle class="mx-3 media-title">
      <div class="d-flex align-center">
        <span class="sort-prefix text-nowrap" style="display: none">
          {{ titleParts[1] }}
        </span>
        <v-chip v-if="titleParts[2]" color="warning" class="mr-3">
          <v-icon>i-mdi:asterisk</v-icon>
        </v-chip>
        <v-chip
          v-if="titleParts[4]"
          color="song"
          prepend-icon="i-mdi:music-note"
          :text="titleParts[4]"
          class="mr-3 font-weight-bold text-subtitle-1 number-chip"
          :title="`${translate('song')} ${cleanTitle(titleParts[4])}`"
        />
        <!-- format-pilcrow is paragraph sign in mdi -->
        <v-chip
          v-if="titleParts[6]"
          color="paragraph"
          :text="titleParts[6]"
          prepend-icon="i-mdi:image-text"
          class="mr-3 font-weight-bold text-subtitle-1 number-chip"
          :title="`${translate('paragraph')} ${cleanTitle(titleParts[6])}`"
        />
        <div
          class="clamp-lines text-regular"
          :title="cleanTitle(titleParts[7] + titleParts[8])"
        >
          {{ titleParts[7] }}<span class="text-grey">{{ titleParts[8] }}</span>
        </div>
      </div>
    </v-list-item-subtitle>
    <template #append>
      <v-list-item-action class="align-self-center d-flex flex-row" end>
        <template v-if="active">
          <pause-btn
            v-if="isLongVideo || (scene && !zoomPart)"
            :toggled="paused"
            :video="isLongVideo"
            :disabled="isLongVideo && !videoStarted"
            tooltip="top"
            @click="togglePaused()"
          />
          <div class="ml-2">
            <icon-btn
              variant="stop"
              tooltip="top"
              :click-twice="isLongVideo"
              @click="stop()"
            />
          </div>
        </template>
        <icon-btn
          v-else
          class="ml-2"
          variant="play"
          :disabled="videoActive"
          @click="play()"
        />
      </v-list-item-action>
    </template>
    <template v-if="!isImage(src)">
      <v-slider
        v-if="active && paused"
        v-model="newProgress"
        density="compact"
        hide-details="auto"
        step="any"
        :min="clippedStart"
        :max="100 - clippedEnd"
        class="video-scrubber"
        :style="`left: ${clippedStart}%; right: ${clippedEnd}%; width: ${
          100 - clippedStart - clippedEnd
        }%`"
      />
      <v-progress-linear
        v-else
        :model-value="progress"
        aria-label="Video progress"
        class="video-progress"
        :bg-opacity="0"
      />
      <v-progress-linear
        v-if="clippedStart > 0"
        :model-value="clippedStart"
        class="video-progress"
        aria-label="Video clipped start"
        color="rgb(231, 76, 60)"
        :bg-opacity="0"
      />
      <v-progress-linear
        v-if="clippedEnd > 0"
        :model-value="clippedEnd"
        class="video-progress"
        aria-label="Video clipped end"
        color="rgb(231, 76, 60)"
        reverse
        :bg-opacity="0"
      />
    </template>
  </v-list-item>
  <div class="mx-4">
    <v-btn
      v-for="marker in markers"
      :key="id + marker.label"
      class="mr-2 mb-2"
      :color="
        marker.playing ? 'primary' : marker.played ? 'info darken-2' : 'info'
      "
      @click="play(marker)"
    >
      {{ marker.label }}
    </v-btn>
  </div>
</template>
<script setup lang="ts">
import { pathToFileURL } from 'url'
import { basename, changeExt, join } from 'upath'
import type { PanzoomObject } from '@panzoom/panzoom'
import { useIpcRenderer } from '@vueuse/electron'

import { pathExists, readJson } from 'fs-extra'
import type { Marker, Times, TimeString, VideoFile } from '~~/types'
import type { PanzoomChangeEvent } from '~~/types/global'

const props = defineProps<{
  src: string
  playNow?: boolean
  stopNow?: boolean
  deactivate?: boolean
  streamingFile?: VideoFile
}>()
const emit = defineEmits<{ (e: 'playing'): void; (e: 'deactivated'): void }>()
onMounted(() => {
  // Sign language markers
  getMarkers()

  // Streaming song
  downloadSong()

  // Panzoom
  if (isImage(props.src)) initPanzoom()
})

// Media active state
const active = ref(false)
const onVideoEnd = () => {
  current.value = false
}
const onResetZoom = () => {
  resetZoom()
}
watch(active, (val) => {
  if (imgPreview.value) {
    imgPreview.value.style.cursor = val ? 'zoom-in' : 'default'
  }

  const ipcRenderer = useIpcRenderer()
  if (val) {
    current.value = true
    ipcRenderer.on('videoEnd', onVideoEnd)
    ipcRenderer.on('resetZoom', onResetZoom)
  } else {
    markers.value.forEach((marker) => {
      marker.playing = false
    })
    progress.value = 0
    newProgress.value = 0
    videoStarted.value = false
    paused.value = false

    ipcRenderer.removeListener('videoEnd', onVideoEnd)
    ipcRenderer.removeListener('resetZoom', onResetZoom)
  }
})
const mediaActive = inject(mediaActiveKey, ref(false))
watch(mediaActive, (val) => {
  if (val && !active.value) {
    current.value = false
  } else if (!val) {
    active.value = false
  }
})

// OBS
const zoomPart = inject(zoomPartKey, ref(false))
const { currentScene: scene } = storeToRefs(useObsStore())

// Media properties
const id = computed(() => strip('mediaitem-' + basename(props.src)))
const url = computed(() => pathToFileURL(props.src).href)
const current = ref(false)
const played = ref(false)
const videoStarted = ref(false)
const videoActive = inject(videoActiveKey, ref(false))
const cleanTitle = (title: string) => {
  return title.replace(/'/g, '&#39;')
}
const titleParts = computed(() => {
  return (props.streamingFile?.safeName || basename(props.src)).split(
    new RegExp(
      `^((?:\\d{1,2}-?){0,3})[ -]*(${translate(
        'footnote',
      )}[ -]*){0,1}(${translate('song')} (\\d+)[ -]*){0,1}(${translate(
        'paragraph',
      )} (\\d+)[ -]*){0,1}(.*)(\\.[0-9a-z]+$)`,
    ),
  )
})

// Download streaming song
const downloading = ref(false)
const streamDownloaded = ref(false)
const localStreamPath = computed(() => {
  if (!props.streamingFile) return ''
  return join(pubPath(props.streamingFile), basename(props.streamingFile.url))
})
const downloadSong = async () => {
  if (!props.streamingFile) return
  downloading.value = true
  await downloadIfRequired({ file: props.streamingFile })
  downloading.value = false
  streamDownloaded.value = await pathExists(localStreamPath.value)
}

// Play media
const tempClipped = ref<TimeString | null>(null)
const play = (marker?: Marker) => {
  if (!usePresentStore().mediaScreenVisible) {
    useIpcRenderer().send('toggleMediaWindowFocus')
  }

  if (marker) {
    marker.played = true
    marker.playing = true
    tempClipped.value = {
      start: marker.customStartTime!,
      end: marker.customEndTime!,
    }
  }
  emit('playing')
  active.value = true
  played.value = true

  if (scene.value) {
    enableMediaScene()
  }

  const stream = !!props.streamingFile && !streamDownloaded.value
  const streamLocal = !!props.streamingFile && streamDownloaded.value
  useIpcRenderer().send('showMedia', {
    src: streamLocal ? localStreamPath.value : props.src,
    stream,
    start: marker ? marker.customStartTime : start.value,
    end: marker ? marker.customEndTime : end.value,
  })
}

// Pause media
const paused = ref(false)
const isLongVideo = computed(() => {
  return isVideo(props.src) && !end.value?.startsWith('00:00:00')
})
const togglePaused = () => {
  if (scene.value && paused.value) {
    enableMediaScene()
  } else if (scene.value) {
    const zoomScene = getPrefs<string>('app.obs.zoomScene')
    setScene(zoomPart.value ? zoomScene || scene.value : scene.value)
  }

  if (isLongVideo.value) {
    newProgress.value = progress.value
    useIpcRenderer().send(paused.value ? 'playVideo' : 'pauseVideo')
  }
  paused.value = !paused.value
}

const enableMediaScene = () => {
  const mediaScene = getPrefs<string>('app.obs.mediaScene')
  const imageScene = getPrefs<string>('app.obs.imageScene')
  if (imageScene && isImage(props.src)) {
    setScene(imageScene)
  } else if (mediaScene) {
    setScene(mediaScene)
  } else {
    warn('errorObsMediaScene')
  }
}

// Stop media
const stop = () => {
  active.value = false
  if (isImage(props.src)) {
    resetZoom()
    useIpcRenderer().send('showMedia', null)
  } else {
    useIpcRenderer().send('hideMedia')
  }
}

// Scrub video
const progress = ref(0)
watch(progress, (val) => {
  if (active.value && val > 0) {
    videoStarted.value = true
  }
})
const newProgress = ref(0)
watch(newProgress, () => {
  if (paused.value) scrubVideo()
})
const scrubVideo = () => {
  useIpcRenderer().send('scrubVideo', newProgress.value)
}

// Set custom start/end times for video
const start = ref<string | null>(null)
const end = ref<string | null>(null)
const video = ref<Times | null>(null)
const clippedStart = computed(() => {
  if (!video.value) return 0
  return (video.value.clipped.start / video.value.original.end) * 100
})
const clippedEnd = computed(() => {
  if (!video.value) return 0
  return (1 - video.value.clipped.end / video.value.original.end) * 100
})
const setTime = (time: Times) => {
  start.value = time.formatted?.start ?? null
  end.value = time.formatted?.end ?? null
  video.value = time
}

// Media playback controls
watch(
  () => props.playNow,
  (val) => {
    if (val) {
      current.value = true
      play()
    }
  },
)

watch(
  () => props.stopNow,
  (val) => {
    if (val) {
      stop()
    }
  },
)

watch(
  () => props.deactivate,
  (val) => {
    if (val) {
      current.value = false
      active.value = false
      emit('deactivated')
    }
  },
)

// Get sign language video markers
const markers = ref<Marker[]>([])
const getMarkers = async () => {
  if (isImage(props.src) || !(await pathExists(changeExt(props.src, 'json'))))
    return
  const { $dayjs } = useNuxtApp()
  const markerArray = (await readJson(changeExt(props.src, 'json'))) as Marker[]

  // For each marker, calculate the custom start and end time
  markerArray.forEach((marker) => {
    marker.playing = false
    const startTime = $dayjs(marker.startTime, 'HH:mm:ss.SSS')
    const duration = $dayjs(marker.duration, 'HH:mm:ss.SSS')
    const transition = $dayjs(marker.endTransitionDuration, 'HH:mm:ss.SSS')

    marker.customStartTime = $dayjs
      .duration({
        hours: +startTime.format('H'),
        minutes: +startTime.format('m'),
        seconds: +startTime.format('s'),
        milliseconds: +startTime.format('SSS'),
      })
      .format('HH:mm:ss.SSS')

    marker.customEndTime = startTime
      .add(
        $dayjs.duration({
          hours: +duration.format('H'),
          minutes: +duration.format('m'),
          seconds: +duration.format('s'),
          milliseconds: +duration.format('SSS'),
        }),
      )
      .subtract(
        $dayjs.duration({
          hours: +transition.format('H'),
          minutes: +transition.format('m'),
          seconds: +transition.format('s'),
          milliseconds: +transition.format('SSS'),
        }),
      )
      .format('HH:mm:ss.SSS')
  })
  markers.value = markerArray
}

// Zoom and pan image
const panzoom = ref<PanzoomObject | null>(null)
const imgPreview: { value: HTMLElement | null } = ref(null)

const onPanzoomChange = (e: CustomEvent<PanzoomChangeEvent>) => {
  if (!imgPreview.value) return
  useIpcRenderer().send('pan', {
    x: e.detail.x / imgPreview.value.clientWidth,
    y: e.detail.y / imgPreview.value.clientHeight,
  })
}

onBeforeUnmount(() => {
  imgPreview.value?.removeEventListener('panzoomchange', onPanzoomChange)
})

const initPanzoom = async () => {
  const { default: Panzoom } = await import('@panzoom/panzoom')
  if (imgPreview.value) {
    panzoom.value = Panzoom(imgPreview.value, {
      animate: true,
      canvas: true,
      contain: 'outside',
      cursor: 'default',
      minScale: 1,
      panOnlyWhenZoomed: true,
    })

    imgPreview.value.addEventListener('panzoomchange', onPanzoomChange)
    resetZoom()
  }
}

// At double click, zoom in or out
const { atClick } = useClickTwice<MouseEvent>((e) => {
  if (!panzoom.value || !active.value) return
  const { maxScale = 4, step = 0.3 } = panzoom.value.getOptions()
  const currentScale = panzoom.value.getScale()
  const newZoom =
    currentScale >= maxScale
      ? resetZoom()
      : panzoom.value.zoomToPoint(currentScale * (1 + step), e!)
  useIpcRenderer().send('zoom', newZoom.scale)
})

// Zoom with wheel
const zoomWithWheel = (e: WheelEvent) => {
  if (!panzoom.value || !active.value) return
  const newZoom = panzoom.value.zoomWithWheel(e)
  useIpcRenderer().send('zoom', newZoom.scale)
  if (imgPreview.value) {
    useIpcRenderer().send('pan', {
      x: newZoom.x / imgPreview.value.clientWidth,
      y: newZoom.y / imgPreview.value.clientHeight,
    })
  }
}

// Reset zoom
const resetZoom = () => {
  return panzoom.value?.reset({ silent: true }) ?? { scale: 1, x: 0, y: 0 }
}
</script>
<style lang="scss" scoped>
.media-item {
  .img-container {
    background: lightgray;

    .img-preview {
      width: 142px;
      height: 80px;
      aspect-ratio: 16 / 9;
      object-fit: contain;
      vertical-align: middle;
    }
  }

  border-left: 8px solid transparent;
  transition: border-left 0.5s;
  &:hover {
    cursor: default;
  }

  &.media-played {
    border-left: 8px solid rgba(55, 90, 127, 0.75) !important;
  }
  &.current-media-item {
    border-left: 8px solid orange !important;
  }

  .media-title {
    font-size: 1rem !important;
    .clamp-lines {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 3;
    }
  }

  .video-progress {
    position: absolute;
    bottom: 0;
    top: unset !important;
  }

  .video-scrubber {
    position: absolute;
    bottom: 0;
    margin: 0;
    margin-bottom: -14px;
  }
}
</style>
<style lang="scss">
.media-item {
  .v-progress-linear:not([aria-valuenow='0']) div {
    transition: width 0.5s linear;
  }
  .v-slider-track {
    height: 4px !important;
  }
  .number-chip {
    min-width: fit-content;
  }
}
</style>
