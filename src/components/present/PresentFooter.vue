<template>
  <v-footer v-if="obsEnabled" app height="64">
    <v-col v-if="scene && zoomScene" cols="auto">
      <v-btn icon variant="text" size="medium" @click="emit('zoomPart')">
        <v-icon
          :icon="zoomPart ? 'i-mdi:video-box' : 'i-mdi:lectern'"
          :color="zoomPart ? 'success' : undefined"
        />
        <v-tooltip location="top" activator="parent">
          {{ $t('obsZoomSceneToggle') }}
        </v-tooltip>
      </v-btn>
    </v-col>
    <v-col v-else-if="obsEnabled && !scene">
      <v-btn
        icon
        variant="text"
        size="small"
        :loading="obsLoading"
        @click="initOBS()"
      >
        <v-icon icon="i-mdi:rotate-right" />
        <v-tooltip location="top" activator="parent">
          {{ $t('obsRefresh') }}
        </v-tooltip>
      </v-btn>
    </v-col>
    <v-col
      v-if="scene && !zoomPart && scenes.length > 1"
      class="d-flex justify-end pa-1"
    >
      <v-btn-toggle v-if="showButtons" v-model="scene" mandatory>
        <template v-for="s in scenes" :key="s.value">
          <v-btn :value="s.value">
            {{ showShortButtons ? s.shortText : s.value }}
            <v-tooltip location="top" activator="parent">
              {{ showShortButtons ? s.title : s.shortcut }}
            </v-tooltip>
          </v-btn>
        </template>
      </v-btn-toggle>
      <v-select
        v-else
        id="input-select-obs-scene"
        v-model="scene"
        :items="scenes"
      />
    </v-col>
  </v-footer>
</template>
<script setup lang="ts">
import { useIpcRendererOn } from '@vueuse/electron'
import type { Participant } from '@zoom/meetingsdk/embedded'
import type { ObsPrefs } from '~~/types'

defineProps<{
  participant: Participant | null
}>()
const emit = defineEmits<{ (e: 'zoomPart'): void }>()
const obsStore = useObsStore()
onMounted(() => {
  if (obsEnabled.value) {
    initOBS().then(() => {
      if (obsStore.connected) {
        const cameraScene = getPrefs<string>('app.obs.cameraScene')
        if (cameraScene) {
          setScene(cameraScene)
        } else {
          warn('errorObsCameraScene')
        }
      }
    })
  }
})

// OBS scenes
const obsLoading = ref(false)
const initOBS = async () => {
  obsLoading.value = true
  await getScenes()
  obsLoading.value = false
}

const mediaActive = inject(mediaActiveKey, ref(false))
const { currentScene, scenes: allScenes } = storeToRefs(obsStore)
const scene = computed({
  get: () => currentScene.value,
  set: (val) => {
    if (val && mediaActive.value) {
      obsStore.currentScene = val
    } else if (val) {
      setScene(val)
    }
  },
})
const scenes = computed(() => {
  return allScenes.value
    .filter(
      (s) =>
        !!s &&
        s !== getPrefs<string>('app.obs.mediaScene') &&
        s !== getPrefs<string>('app.obs.zoomScene') &&
        s !== getPrefs<string>('app.obs.imageScene'),
    )
    .map((s, i) => {
      let shortcut = `Alt+${i + 1}`
      if (i === 9) shortcut = `Alt+0`
      if (i > 9) shortcut = ''
      return {
        shortcut,
        title: `${shortcut}: ${s}`,
        value: s,
        shortText: s
          .replace('+', ' + ')
          .replace('  ', ' ')
          .split(' ')
          .map((w) => w[0])
          .join('')
          .toUpperCase(),
      }
    })
})

useIpcRendererOn('setObsScene', (_e, key: number) => {
  log.debug('Set obs scene via shortcut', key)
  const index = key === 0 ? 9 : key - 1
  if (index + 1 > scenes.value.length) return
  const s = scenes.value[index]
  scene.value = s.value
})
const obsEnabled = computed(() => {
  const { enable, port, password } = getPrefs<ObsPrefs>('app.obs')
  return enable && !!port && !!password
})

// Zoom part/scene
const zoomPart = inject(zoomPartKey, ref(false))
const zoomScene = computed(() => {
  const zScene = getPrefs<string>('app.obs.zoomScene')
  if (!zScene || !allScenes.value.includes(zScene)) return null
  return zScene
})

// Computed width of the buttons
const showButtons = computed(
  () => shortScenesLength.value < availableWidth.value,
)
const showShortButtons = computed(
  () => combinedScenesLength.value > availableWidth.value,
)

const windowSize = inject(windowSizeKey, { width: ref(0), height: ref(0) })
const availableWidth = computed(() => {
  let BUTTONS = 0
  const SIDE_NAV = 56
  const FOOTER_PADDING = 32
  const ZOOM_BUTTON = 50
  if (zoomScene.value) BUTTONS += ZOOM_BUTTON
  const OBS_MENU_PADDING = 8
  const WIDTH_OF_OTHER_ELEMENTS =
    SIDE_NAV + FOOTER_PADDING + BUTTONS + OBS_MENU_PADDING
  return windowSize.width.value - WIDTH_OF_OTHER_ELEMENTS
})

const getSceneWidth = (sceneLength: number) => {
  const BASE_WIDTH = 64
  if (sceneLength <= 3) return BASE_WIDTH
  return BASE_WIDTH + (sceneLength - 3) * 6
}

const shortScenesLength = computed(() => {
  let combinedLength = 0
  for (const scene of scenes.value) {
    combinedLength += getSceneWidth(scene.shortText.length)
  }
  return combinedLength
})

const combinedScenesLength = computed(() => {
  let combinedLength = 0
  for (const scene of scenes.value) {
    combinedLength += getSceneWidth(scene.title.length)
  }
  return combinedLength
})
</script>
