<!-- eslint-disable vue/no-v-html -->
<template>
  <v-form ref="appForm" v-model="valid">
    <form-input
      id="app.offline"
      v-model="app.offline"
      field="switch"
      :label="$t('offlineMode')"
      :locked="isLocked('app.offline')"
    />
    <form-input
      id="app.theme"
      v-model="app.theme"
      field="select"
      class="theme-preference"
      :items="[
        { title: $t('light'), value: 'light' },
        { title: $t('dark'), value: 'dark' },
        { title: $t('system'), value: 'system' },
      ]"
      :label="$t('themePreference')"
      :locked="isLocked('app.theme')"
    />
    <form-input
      id="app.congregationName"
      v-model="app.congregationName"
      :label="$t('congregationName')"
      :locked="isLocked('app.congregationName')"
      required
      @blur="renameBg()"
    />
    <form-input
      id="app.localAppLang"
      v-model="app.localAppLang"
      field="autocomplete"
      :label="$t('localAppLang')"
      :items="localesMapped"
      item-title="name"
      item-value="code"
      required
      auto-select-first
      :locked="isLocked('app.localAppLang')"
    />
    <v-row>
      <v-col cols="auto" class="pr-0 mt-1 text-left">
        <v-btn
          id="app.localOutputPathBtn"
          color="primary"
          style="height: 44px"
          :disabled="isLocked('app.localOutputPath')"
          @click="setLocalOutputPath"
        >
          {{ $t('browse') }}
        </v-btn>
      </v-col>
      <v-col class="pl-0">
        <form-input
          id="app.localOutputPath"
          v-model="app.localOutputPath"
          :label="$t('mediaSaveFolder')"
          readonly
          required
          hide-details="auto"
          :locked="isLocked('app.localOutputPath')"
        />
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="auto" class="pr-0 mt-1 text-left">
        <v-btn
          id="app.customCachePathBtn"
          color="primary"
          style="height: 44px"
          :disabled="isLocked('app.customCachePath')"
          @click="setCustomCachePath"
        >
          {{ $t('browse') }}
        </v-btn>
      </v-col>
      <v-col class="pl-0">
        <form-input
          id="app.customCachePath"
          v-model="app.customCachePath"
          :label="$t('customCachePath')"
          readonly
          clearable
          :locked="isLocked('app.customCachePath')"
        />
      </v-col>
    </v-row>
    <form-input
      id="app.outputFolderDateFormat"
      v-model="app.outputFolderDateFormat"
      field="select"
      :label="$t('outputFolderDateFormat')"
      :items="formats"
      :locked="isLocked('app.outputFolderDateFormat')"
    />
    <v-divider class="mb-6" />
    <form-input
      v-if="!isLinux"
      id="app.autoRunAtBoot"
      v-model="app.autoRunAtBoot"
      field="switch"
      :label="$t('autoRunAtBoot')"
      :locked="isLocked('app.autoRunAtBoot')"
    />
    <template v-for="(option, i) in automationOptions">
      <v-divider v-if="option === 'div'" :key="'div-' + i" class="mb-6" />
      <form-input
        v-else
        :id="`app.${option}`"
        :key="option"
        v-model="app[option]"
        field="switch"
        :label="$t(option)"
        :locked="isLocked(`app.${option}`)"
      />
    </template>
    <form-input
      id="app.obs.enable"
      v-model="app.obs.enable"
      field="switch"
      :locked="isLocked('app.obs.enable')"
    >
      <template #label>
        <span v-html="$t('obsEnable')" />
      </template>
    </form-input>
    <template v-if="app.obs.enable">
      <form-input
        id="app.obs.useV4"
        v-model="app.obs.useV4"
        field="switch"
        :locked="isLocked('app.obs.useV4')"
      >
        <template #label>
          <span v-html="$t('obsUseV4')" />
        </template>
      </form-input>
      <form-input
        id="app.obs.port"
        v-model="app.obs.port"
        :label="$t('port')"
        :locked="isLocked('app.obs.port')"
        required
        :rules="[(v: string) => !v || isValidPort(v) || $t('fieldInvalid')]"
        @blur="refreshOBS()"
        @keydown.enter.prevent="refreshOBS()"
      />
      <form-input
        id="app.obs.password"
        v-model="app.obs.password"
        field="password"
        :label="$t('password')"
        :locked="isLocked('app.obs.password')"
        hide-details="auto"
        required
        @blur="refreshOBS()"
        @keydown.enter.prevent="refreshOBS()"
      />
      <v-col cols="12" class="text-right pr-0">
        <v-btn
          id="app.obs.refreshOBS"
          :disabled="!obsComplete"
          :color="scenes.length > 0 ? 'success' : 'primary'"
          @click="refreshOBS()"
        >
          <v-icon icon="i-mdi:book-refresh" />
        </v-btn>
      </v-col>
      <form-input
        id="app.obs.cameraScene"
        v-model="app.obs.cameraScene"
        field="select"
        :items="cameraScenes"
        :label="$t('obsCameraScene')"
        :disabled="cameraScenes.length === 0"
        :locked="isLocked('app.obs.cameraScene')"
        required
      />
      <form-input
        id="app.obs.mediaScene"
        v-model="app.obs.mediaScene"
        field="select"
        :items="mediaScenes"
        :label="$t('obsMediaScene')"
        :disabled="cameraScenes.length === 0"
        :locked="isLocked('app.obs.mediaScene')"
        required
      />
      <form-input
        id="app.obs.imageScene"
        v-model="app.obs.imageScene"
        field="select"
        :items="imageScenes"
        :label="$t('obsImageScene')"
        :disabled="cameraScenes.length === 0"
        :locked="isLocked('app.obs.imageScene')"
        clearable
      />
      <form-input
        id="app.obs.zoomScene"
        v-model="app.obs.zoomScene"
        field="select"
        :items="zoomScenes"
        :label="$t('obsZoomScene')"
        explanation="obsZoomSceneExplain"
        :disabled="cameraScenes.length === 0"
        :locked="isLocked('app.obs.zoomScene')"
        clearable
      />
    </template>
    <v-divider class="mb-6" />
    <form-input
      id="app.zoom.enable"
      v-model="app.zoom.enable"
      field="switch"
      explanation="enableZoomExplain"
      :locked="isLocked('app.zoom.enable')"
    >
      <template #label>
        <span v-html="`${$t('zoomEnable')} [BETA]`" />
      </template>
    </form-input>
    <template v-if="app.zoom.enable">
      <form-input
        id="app.zoom.name"
        v-model="app.zoom.name"
        :label="$t('zoomName')"
        :locked="isLocked('app.zoom.name')"
        required
      />
      <form-input
        id="app.zoom.id"
        v-model="app.zoom.id"
        :label="$t('zoomId')"
        :locked="isLocked('app.zoom.id')"
        required
      />
      <form-input
        id="app.zoom.password"
        v-model="app.zoom.password"
        field="password"
        :label="$t('password')"
        :locked="isLocked('app.zoom.password')"
        required
      />
      <form-input
        id="app.zoom.spotlight"
        v-model="app.zoom.spotlight"
        field="switch"
        :label="$t('zoomSpotlight')"
        :locked="isLocked('app.zoom.spotlight')"
      />
      <form-input
        id="app.zoom.autoStartMeeting"
        v-model="app.zoom.autoStartMeeting"
        field="switch"
        :label="$t('zoomAutoStartMeeting')"
        :locked="isLocked('app.zoom.autoStartMeeting')"
      />
      <form-input
        v-if="app.zoom.autoStartMeeting"
        id="app.zoom.autoStartTime"
        v-model="app.zoom.autoStartTime"
        field="slider"
        :min="1"
        :max="10"
        :group-label="autoStartMeeting"
        :locked="isLocked('app.zoom.autoStartTime')"
      />
      <v-col class="d-flex pa-0 pb-2 align-center">
        <form-input
          id="app.zoom.autoRename"
          v-model="newAutoRename"
          :label="$t('zoomAutoRename')"
          :placeholder="$t('zoomAutoRenameFormat')"
          hide-details="auto"
        />
        <v-btn class="ml-2" color="primary" @click="addAutoRename()">
          <v-icon icon="i-mdi:plus" size="small" />
        </v-btn>
      </v-col>
      <v-col>
        <v-chip
          v-for="(name, i) in app.zoom.autoRename"
          :key="name"
          closable
          class="mb-2 mr-2"
          @click:close="removeAutoRename(i)"
        >
          {{ name }}
        </v-chip>
      </v-col>
    </template>
    <v-divider class="mb-6" />
    <form-input
      v-for="option in disableOptions"
      :id="`app.${option}`"
      :key="option"
      v-model="app[option]"
      field="switch"
      :locked="isLocked(`app.${option}`)"
    >
      <template #label>
        <span v-html="$t(option)" />
      </template>
    </form-input>
  </v-form>
</template>
<script setup lang="ts">
import { platform } from 'os'
import { ipcRenderer } from 'electron'
import { extname, join } from 'upath'
import type { LocaleObject } from '#i18n'
import { existsSync } from 'fs-extra'
import type { AppPrefs, VFormRef, PrefStore } from '~~/types'

const props = defineProps<{
  prefs: PrefStore
}>()
const emit = defineEmits<{
  valid: [val: boolean]
  refresh: [val: AppPrefs]
}>()
const valid = ref(true)
watch(valid, (val) => {
  emit('valid', val)
})
const appForm = ref<VFormRef | null>()
const localesMapped = ref<{ name: string; code: string }[]>([])
const { locale, locales, localeProperties } = useI18n()
onMounted(() => {
  localesMapped.value = locales.value.map((l) => {
    const locale = l as LocaleObject
    return {
      name: locale.name!,
      code: locale.code,
    }
  })
  oldName.value = app.value.congregationName
  app.value.localAppLang = locale.value
  if (obsComplete.value) {
    getScenes().then(() => {
      if (appForm.value) {
        appForm.value.validate()
      }
    })
  } else if (appForm.value) {
    appForm.value.validate()
  }
})

// Prefs
const { client, prefs: app } = usePrefs<AppPrefs>('app', emit)

const isLinux = platform() === 'linux'
const disableOptions: (keyof AppPrefs)[] = [
  'betaUpdates',
  'disableAutoUpdate',
  'disableHardwareAcceleration',
]
const automationOptions: (keyof AppPrefs | 'div')[] = [
  // 'autoStartSync',
  'div',
  'autoOpenFolderWhenDone',
  'autoQuitWhenDone',
  'div',
]

const { setTheme } = useTheme()
watch(
  () => app.value.theme,
  async (val) => {
    ipcRenderer.send('setTheme', val)
    setTheme(val === 'system' ? await ipcRenderer.invoke('theme') : val)
  },
)

watch(
  () => app.value.autoRunAtBoot,
  (val) => {
    ipcRenderer.send('runAtBoot', val)
  },
)

watch(
  () => app.value.localAppLang,
  (val, oldVal) => {
    if (!val) return
    const { $dayjs } = useNuxtApp()
    const newLocale = (locales.value as LocaleObject[]).find(
      (l) => l.code === val,
    )!

    const oldLocale = (locales.value as LocaleObject[]).find(
      (l) => l.code === oldVal,
    )
    $dayjs.locale(newLocale.dayjs ?? val)
    if (oldLocale && val !== oldVal) {
      useMediaStore().clear()
      renamePubs(oldLocale, newLocale)
    }
    if (val !== locale.value) {
      log.debug('Change localAppLang')
      useRouter().replace(useSwitchLocalePath()(val))
    }
  },
)
const dateFormats = [
  'DD-MM-YYYY',
  'YYYY-MM-DD',
  'DD-MM-YYYY - dddd',
  'YYYY-MM-DD - dddd',
]
const formats = dateFormats.map((f) => {
  return {
    title: useNuxtApp().$dayjs().format(f),
    value: f,
  }
})

watch(
  () => app.value.outputFolderDateFormat,
  (val, oldVal) => {
    const mPath = mediaPath()
    if (mPath) {
      renameAll(mPath, oldVal, val, 'rename', 'date')
    }
    useMediaStore().updateDateFormat({
      oldFormat: oldVal,
      newFormat: val,
      locale: localeProperties.value.dayjs ?? locale.value,
    })
  },
)

watch(
  () => app.value.betaUpdates,
  (val) => {
    ipcRenderer.send('toggleBetaUpdates', val)
  },
)
watch(
  () => app.value.disableAutoUpdate,
  (val) => {
    ipcRenderer.send('toggleAutoUpdate', !val)
  },
)
watch(
  () => app.value.disableHardwareAcceleration,
  (val) => {
    const path = join(appPath(), 'disableHardwareAcceleration')
    const fileExists = existsSync(path)
    // Only do something if the value is not in sync with the presence of the file
    if (val && !fileExists) {
      write(path, '')
    } else if (!val && fileExists) {
      rm(path)
    }

    if (val !== fileExists) {
      ipcRenderer.send('restart')
    }
  },
)

// Zoom options
watch(
  () => app.value.zoom.enable,
  () => {
    appForm.value?.validate()
  },
)
const autoStartMeeting = useComputedLabel<AppPrefs>(
  'minutesBeforeMeeting',
  app,
  'zoom',
  PREFS.app.zoom.autoStartTime!,
  'autoStartTime',
)
const newAutoRename = ref('')
const addAutoRename = () => {
  if (!newAutoRename.value) return
  app.value.zoom.autoRename.push(newAutoRename.value)
  newAutoRename.value = ''
}
const removeAutoRename = (index: number) => {
  app.value.zoom.autoRename.splice(index, 1)
}

// OBS options
watch(
  () => app.value.obs.enable,
  (val) => {
    setPrefs('app.obs.enable', val)
    if (val && obsComplete.value) {
      getScenes().then(() => {
        if (appForm.value) appForm.value.validate()
      })
    } else {
      resetOBS()
    }
    appForm.value?.validate()
  },
)
watch(
  () => app.value.obs.useV4,
  (val) => {
    setPrefs('app.obs.useV4', val)
    if (obsComplete.value) {
      getScenes()
    }
  },
)
const scenes = computed(() => useObsStore().scenes)
const cameraScenes = computed(() => {
  return scenes.value.filter(
    (s) =>
      s !== app.value.obs.mediaScene &&
      s !== app.value.obs.zoomScene &&
      s !== app.value.obs.imageScene,
  )
})
const mediaScenes = computed(() => {
  return scenes.value.filter(
    (s) =>
      s !== app.value.obs.cameraScene &&
      s !== app.value.obs.zoomScene &&
      s !== app.value.obs.imageScene,
  )
})
const imageScenes = computed(() => {
  const sceneList = scenes.value.filter(
    (s) =>
      s !== app.value.obs.cameraScene &&
      s !== app.value.obs.zoomScene &&
      s !== app.value.obs.mediaScene,
  )
  if (
    app.value.obs.imageScene &&
    !scenes.value.includes(app.value.obs.imageScene)
  ) {
    sceneList.push(app.value.obs.imageScene)
  }
  return sceneList
})
const zoomScenes = computed(() => {
  const sceneList = scenes.value.filter(
    (s) =>
      s !== app.value.obs.cameraScene &&
      s !== app.value.obs.mediaScene &&
      s !== app.value.obs.imageScene,
  )
  if (
    app.value.obs.zoomScene &&
    !scenes.value.includes(app.value.obs.zoomScene)
  ) {
    sceneList.push(app.value.obs.zoomScene)
  }
  return sceneList
})
const obsComplete = computed(() => {
  return (
    app.value.obs.enable &&
    isValidPort(app.value.obs.port) &&
    !!app.value.obs.password
  )
})
const isValidPort = (port: string | null) => {
  if (!port) return false
  const regexExp =
    /^((6553[0-5])|(655[0-2]\d)|(65[0-4]\d{2})|(6[0-4]\d{3})|([1-5]\d{4})|([0-5]{0,5})|(\d{1,4}))$/gi

  return regexExp.test(port)
}
const refreshOBS = async () => {
  if (obsComplete.value) {
    await resetOBS()
    getScenes()
  }
}

// Set local paths
watch(
  () => app.value.localOutputPath,
  (val) => {
    if (!val) return
    const badCharacters = val.match(/(\\?)([()*?[\]{|}]|^!|[!+@](?=\())/g)
    if (badCharacters) {
      warn('errorBadOutputPath', {
        identifier: badCharacters.join(' '),
      })
      app.value.localOutputPath = null
    }
  },
)
const setLocalOutputPath = async () => {
  const result = await ipcRenderer.invoke('openDialog', {
    properties: ['openDirectory'],
  })
  if (result && !result.canceled) {
    app.value.localOutputPath = result.filePaths[0]
  }
}
watch(
  () => app.value.customCachePath,
  (val, oldVal) => {
    const defaultPath = (folder: string) => join(appPath(), folder)
    if (val && !oldVal) {
      move(defaultPath('Publications'), join(val, 'Publications'))
      move(defaultPath('Fonts'), join(val, 'Fonts'))
    } else if (!val && oldVal) {
      move(join(oldVal, 'Publications'), defaultPath('Publications'), true)
      move(join(oldVal, 'Fonts'), defaultPath('Fonts'), true)
    } else {
      move(join(oldVal, 'Publications'), join(val, 'Publications'))
      move(join(oldVal, 'Fonts'), join(val, 'Fonts'))
    }
  },
)
const setCustomCachePath = async () => {
  const result = await ipcRenderer.invoke('openDialog', {
    properties: ['openDirectory'],
  })
  if (result && !result.canceled) {
    app.value.customCachePath = result.filePaths[0]
  }
}

// Rename background image when congregation name changes
const oldName = ref<string | null>(PREFS.app.congregationName)
watchDebounced(
  () => app.value.congregationName,
  (val) => {
    if (!val) return
    useNuxtApp().$sentry.setUser({
      username: val,
    })
  },
  { debounce: 500, maxWait: 1000 },
)
const renameBg = async () => {
  if (oldName.value && app.value.congregationName) {
    const bgName = (congName: string) => `custom-background-image-${congName}`
    const bg = findOne(join(appPath(), bgName(oldName.value) + '*'))

    if (!bg) return

    move(
      bg,
      join(appPath(), bgName(app.value.congregationName) + extname(bg)),
      true,
    )

    if (client.value && props.prefs.cong.dir) {
      await client.value.moveFile(
        join(props.prefs.cong.dir, bgName(oldName.value) + extname(bg)),
        join(
          props.prefs.cong.dir,
          bgName(app.value.congregationName) + extname(bg),
        ),
      )
    }
  }

  oldName.value = app.value.congregationName
}
</script>
