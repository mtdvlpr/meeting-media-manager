<!-- eslint-disable vue/no-v-html -->
<template>
  <v-form ref="mediaForm" v-model="valid" class="media-settings">
    <form-input
      id="media.lang"
      v-model="media.lang"
      field="autocomplete"
      :label="$t('mediaLang')"
      :items="langs"
      item-title="name"
      item-value="langcode"
      :loading="loading"
      :locked="isLocked('media.lang')"
      auto-select-first
      required
    />
    <form-input
      id="media.langFallback"
      v-model="media.langFallback"
      field="autocomplete"
      :label="$t('langFallback')"
      :items="fallbackLangs"
      item-title="name"
      item-value="langcode"
      :loading="loading"
      :locked="isLocked('media.langFallback')"
      auto-select-first
      clearable
    />
    <form-input
      id="media.maxRes"
      v-model="media.maxRes"
      field="btn-group"
      group-label="maxRes"
      :locked="isLocked('media.maxRes')"
      :group-items="resolutions"
      mandatory
      required
    />
    <v-divider class="mb-6" />
    <form-input
      id="media.enableSubtitles"
      v-model="media.enableSubtitles"
      field="switch"
      :locked="isLocked('media.enableSubtitles')"
      :label="$t('enableSubtitles')"
    />
    <form-input
      v-if="media.enableSubtitles"
      id="media.langSubs"
      v-model="media.langSubs"
      field="autocomplete"
      :label="$t('langSubs')"
      :items="subLangs"
      item-title="name"
      item-value="langcode"
      :loading="loading"
      :locked="isLocked('media.langSubs')"
      auto-select-first
      required
    />
    <v-divider class="mb-6" />
    <form-input
      id="media.enableMp4Conversion"
      v-model="media.enableMp4Conversion"
      field="switch"
      explanation="enableMp4ConversionExplain"
      :locked="isLocked('media.enableMp4Conversion')"
      :label="$t('enableMp4Conversion')"
    />
    <form-input
      v-if="media.enableMp4Conversion"
      id="media.keepOriginalsAfterConversion"
      v-model="media.keepOriginalsAfterConversion"
      field="switch"
      :locked="isLocked('media.keepOriginalsAfterConversion')"
      :label="$t('keepOriginalsAfterConversion')"
    />
    <v-divider class="mb-6" />
    <form-input
      id="media.enableMediaDisplayButton"
      v-model="media.enableMediaDisplayButton"
      field="switch"
      :locked="isLocked('media.enableMediaDisplayButton')"
      :label="$t('enableMediaDisplayButton')"
    />
    <template v-if="media.enableMediaDisplayButton">
      <form-input
        v-if="screens.length > 0"
        id="media.preferredOutput"
        v-model="media.preferredOutput"
        field="select"
        item-value="id"
        :items="[{ id: 'window', title: $t('window') }, ...screens]"
        :locked="isLocked('media.preferredOutput')"
        :label="$t('preferredOutput')"
      />
      <v-row v-if="bg" class="mb-4">
        <v-col align-self="center" class="text-left">
          {{ $t('mediaWindowBackground') }}
        </v-col>
        <v-col
          id="mediaWindowBackground"
          class="align-center col d-flex justify-center text-no-wrap"
          :style="bg === 'yeartext' ? 'background-color: black;' : ''"
        >
          <v-img
            v-if="bg === 'custom'"
            :src="background"
            alt="Custom Background"
            cover
            style="max-width: 300px; max-height: 100px"
          />
          <div v-else>
            <div id="yeartextLogoContainer">
              <div id="yeartextLogo"></div>
            </div>
            <div id="yeartextContainer" v-html="background" />
          </div>
        </v-col>
        <v-col cols="auto" align-self="center" class="d-flex flex-column">
          <v-btn
            v-if="bg === 'yeartext'"
            color="primary"
            class="mb-2"
            icon="i-mdi:image-edit-outline"
            @click="uploadBg()"
          />
          <v-btn v-else color="error" class="mb-2" @click="removeBg()">
            {{ $t('delete') }}
          </v-btn>
          <v-btn
            color="warning"
            class="mb-2"
            min-width="32px"
            icon="i-mdi:web-refresh"
            @click="refreshBg()"
          />
        </v-col>
      </v-row>
      <v-row>
        <v-col>
          <form-input
            id="media.mediaWinShortcut"
            v-model="media.mediaWinShortcut"
            :locked="isLocked('media.mediaWinShortcut')"
            placeholder="e.g. Alt+Z"
            :label="$t('mediaWinShortcut')"
            required
            :rules="getShortcutRules('toggleMediaWindow')"
          />
        </v-col>
        <v-col>
          <form-input
            id="media.presentShortcut"
            v-model="media.presentShortcut"
            :locked="isLocked('media.presentShortcut')"
            placeholder="e.g. Alt+D"
            :label="$t('presentShortcut')"
            required
            :rules="getShortcutRules('openPresentMode')"
          />
        </v-col>
      </v-row>
      <form-input
        id="media.hideMediaLogo"
        v-model="media.hideMediaLogo"
        field="switch"
        :locked="isLocked('media.hideMediaLogo')"
        :label="$t('hideMediaLogo')"
      />
      <form-input
        id="media.hideWinAfterMedia"
        v-model="media.hideWinAfterMedia"
        field="switch"
        explanation="hideWinAfterMediaExplain"
        :locked="isLocked('media.hideWinAfterMedia')"
        :label="$t('hideWinAfterMedia')"
      />
      <form-input
        id="media.autoPlayFirst"
        v-model="media.autoPlayFirst"
        field="switch"
        :label="$t('autoPlayFirst')"
        :locked="isLocked('media.autoPlayFirst')"
      />
      <form-input
        v-if="media.autoPlayFirst"
        id="media.autoPlayFirstTime"
        v-model="media.autoPlayFirstTime"
        field="slider"
        :min="1"
        :max="15"
        custom-input
        :group-label="playMinutesBeforeMeeting"
        :locked="isLocked('media.autoPlayFirstTime')"
        hide-details="auto"
      />
      <form-input
        id="media.enablePp"
        v-model="media.enablePp"
        field="switch"
        :locked="isLocked('media.enablePp')"
        :label="$t('enablePp')"
      />
      <template v-if="media.enablePp">
        <form-input
          id="media.ppForward"
          v-model="media.ppForward"
          :locked="isLocked('media.ppForward')"
          placeholder="e.g. PageDown / Alt+F / Alt+N"
          :label="$t('ppForward')"
          required
          :rules="getShortcutRules('nextMediaItem')"
        />
        <form-input
          id="media.ppBackward"
          v-model="media.ppBackward"
          placeholder="e.g. PageUp / Alt+B / Alt+P"
          :locked="isLocked('media.ppBackward')"
          :label="$t('ppBackward')"
          required
          :rules="getShortcutRules('previousMediaItem')"
        />
      </template>
    </template>
    <template v-for="(option, i) in includeOptions">
      <v-divider v-if="option === 'div'" :key="'div-' + i" class="mb-6" />
      <form-input
        v-else
        :id="`media.${option}`"
        :key="option"
        v-model="media[option]"
        field="switch"
        :locked="isLocked(`media.${option}`)"
      >
        <template #label>
          <span v-html="$t(option)" />
        </template>
      </form-input>
    </template>
  </v-form>
</template>
<script setup lang="ts">
import { readFile } from 'fs-extra'
import { extname, join } from 'upath'
import { ipcRenderer } from 'electron'
import type { MediaPrefs, PrefStore, ShortJWLang, VFormRef } from '~~/types'

const props = defineProps<{
  prefs: PrefStore
}>()

const emit = defineEmits<{
  (e: 'valid', val: boolean): void
  (e: 'refresh', prefs: MediaPrefs): void
}>()

const { client, prefs: media } = usePrefs<MediaPrefs>('media', emit)
const RESOLUTIONS = ['240p', '360p', '480p', '720p']
const resolutions = RESOLUTIONS.map((r) => {
  return {
    title: r,
    value: r,
  }
})

const includeOptions: (keyof MediaPrefs | 'div')[] = [
  'div',
  'enableVlcPlaylistCreation',
  'div',
  'excludeTh',
  'excludeLffImages',
  'includePrinted',
]

const loading = ref(true)
const jwLangs = ref<ShortJWLang[]>([])
const mediaForm = ref<VFormRef | null>()
const valid = ref(true)
watch(valid, (val) => {
  emit('valid', val)
})
const getLangs = async () => {
  jwLangs.value = await getJWLangs()
  if (
    media.value.lang &&
    !langs.value.map((l) => l.langcode).includes(media.value.lang)
  ) {
    media.value.lang = null
  }

  loading.value = false
}
onMounted(() => {
  getLangs()
  if (media.value.enableMediaDisplayButton) {
    loadFont('yeartext')
    loadFont('icon')
    loadBg()
  }

  if (mediaForm.value) mediaForm.value.validate()
  if (valid.value) emit('valid', true)
})

// Presentation Mode
const { background, screens, mediaScreenInit } = storeToRefs(usePresentStore())
watch(
  () => media.value.enableMediaDisplayButton,
  (val) => {
    if (val !== mediaScreenInit.value) {
      toggleMediaWindow(val ? 'open' : 'close')
    } else {
      ipcRenderer.send('hideMediaWindow')
    }

    if (val) {
      if (
        media.value.preferredOutput === 'window' &&
        screens.value.length > 0
      ) {
        media.value.preferredOutput = screens.value[0].id
      }
      loadBg()
    }
    mediaForm.value?.validate()
    useStatStore().setShowMediaPlayback(val)
  },
)
watch(
  () => media.value.preferredOutput,
  (val) => {
    setPrefs('media.preferredOutput', val)
    if (media.value.enableMediaDisplayButton) {
      getMediaWindowDestination().then((dest) => {
        ipcRenderer.send('showMediaWindow', dest)
      })
    }
  },
)
watch(
  () => media.value.hideMediaLogo,
  (val) => {
    refreshBackgroundImgPreview()
    const ytLogo = document.querySelector<HTMLDivElement>(
      '#yeartextLogoContainer',
    )
    if (ytLogo) ytLogo.style.display = !val ? 'block' : 'none'
  },
)
watch(
  () => media.value.enablePp,
  () => {
    if (mediaForm.value) mediaForm.value.validate()
  },
)

const playMinutesBeforeMeeting = useComputedLabel<MediaPrefs>(
  'minutesBeforeMeeting',
  media,
  'autoPlayFirstTime',
  PREFS.media.autoPlayFirstTime!,
)

// Languages
const langs = computed(() => {
  return jwLangs.value.map((lang) => {
    return {
      name: `${lang.vernacularName} (${lang.name})`,
      langcode: lang.langcode,
      isSignLanguage: lang.isSignLanguage,
      mwbAvailable: lang.mwbAvailable,
      wAvailable: lang.wAvailable,
    }
  })
})
watch(
  () => media.value.lang,
  (val) => {
    if (!val) return
    setPrefs('media.lang', val)
    useDbStore().clear()
    useMediaStore().clear()
    getJWLangs()
    getPubAvailability(val)
    if (bg.value === 'yeartext') {
      refreshBackgroundImgPreview(true)
    }
  },
)
const subLangs = computed(() => langs.value.filter((l) => !l.isSignLanguage))
watch(
  () => media.value.enableSubtitles,
  () => {
    mediaForm.value?.validate()
  },
)
watch(
  () => media.value.langSubs,
  (val) => {
    if (val) getPubAvailability(val)
  },
)
const fallbackLangs = computed(() => {
  return langs.value.filter(
    (l) =>
      l.langcode !== media.value.lang &&
      (l.wAvailable !== false || l.mwbAvailable !== false),
  )
})
watch(
  () => media.value.langFallback,
  (val) => {
    useDbStore().clear()
    useMediaStore().clear()
    if (!val) return
    getJWLangs()
    getPubAvailability(val)
  },
)

// Shortcuts
watch(
  () => media.value.mediaWinShortcut,
  (val) => {
    changeShortcut(val, 'toggleMediaWindow')
  },
)

watch(
  () => media.value.presentShortcut,
  (val) => {
    changeShortcut(val, 'openPresentMode')
    const store = useStatStore()
    store.setShowMediaPlayback(false)
    store.setShowMediaPlayback(true)
  },
)

// Media window background
const bg = ref('')
const bgFilename = () => {
  return `custom-background-image-${props.prefs.app.congregationName}`
}

const loadBg = async () => {
  bg.value = await refreshBackgroundImgPreview()
}

const refreshBg = () => {
  refreshBackgroundImgPreview()
}

const uploadBg = async () => {
  const result = await ipcRenderer.invoke('openDialog', {
    properties: ['openFile'],
    filters: [
      { name: 'Image', extensions: ['jpg', 'png', 'jpeg', 'gif', 'svg'] },
    ],
  })
  if (!result || result.canceled) return
  if (isImage(result.filePaths[0])) {
    const background = result.filePaths[0]
    const filename = bgFilename()
    const extension = extname(background)
    rm(findAll(join(appPath(), filename + '*')))
    copy(background, join(appPath(), filename + extension))

    // Upload the background to the cong server
    if (client.value && props.prefs.cong.dir) {
      await client.value.putFileContents(
        join(props.prefs.cong.dir, filename + extension),
        await readFile(background),
        {
          overwrite: true,
        },
      )
    }

    loadBg()
  } else {
    warn('notAnImage')
  }
}

const removeBg = async () => {
  const filename = bgFilename()
  const background = findAll(join(appPath(), filename + '*'))
  rm(background)

  // Remove the background from the cong server
  if (client.value && background.length > 0 && props.prefs.cong.dir) {
    const extension = extname(background[0])
    try {
      await client.value.deleteFile(
        join(props.prefs.cong.dir, filename + extension),
      )
    } catch (e: any) {
      if (e.message.includes(LOCKED.toString())) {
        warn('errorWebdavLocked', {
          identifier: filename + extension,
        })
      } else if (e.status !== NOT_FOUND) {
        error('errorWebdavRm', e, filename + extension)
      }
    }
  }

  // Refresh the media screen background
  loadBg()
  loadFont('yeartext')
}
</script>
<style lang="scss" scoped>
.media-settings {
  #yeartextContainer {
    font-family: 'Wt-ClearText-Bold', 'NotoSerif', serif;
    font-size: 1cqw;
    text-align: center;
  }

  #yeartextLogoContainer {
    font-family: JW-Icons;
    font-size: 1.6cqw;
    position: absolute;
    bottom: 1.5cqw;
    right: 1.5cqw;
    box-sizing: unset;
    color: black !important;
    background: rgba(255, 255, 255, 0.2);
    border: rgba(255, 255, 255, 0) 0.15cqw solid;
    overflow: hidden;
    width: 1.2cqw;
    height: 1.2cqw;

    #yeartextLogo {
      margin: -0.6cqw -0.45cqw;
    }
  }

  #mediaWindowBackground {
    color: white;
    aspect-ratio: 16/9;
    max-width: 25vw;
    position: relative;

    p {
      margin-bottom: 0;
    }
  }
}
</style>
