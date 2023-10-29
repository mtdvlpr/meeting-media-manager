<!-- Select a congregation on startup -->
<template>
  <div class="cong-select">
    <v-app-bar>
      <v-app-bar-title>
        {{ $t('selectCong') }}
      </v-app-bar-title>
    </v-app-bar>
    <v-row no-gutters justify="start" align="start" class="pa-4">
      <v-col cols="12">
        <loading-icon v-if="loading" />
        <v-list v-else>
          <v-list-item
            v-for="c in congs"
            :key="c.id"
            :title="c.name"
            :active="c.id === cong"
            @click="initPrefs(c.filename)"
          >
            <template v-if="c.id !== cong" #append>
              <v-btn
                icon="i-mdi:delete"
                variant="text"
                color="error"
                size="small"
                @click="removeCong(c.path)"
              />
            </template>
          </v-list-item>
          <v-list-item
            prepend-icon="i-mdi:plus"
            :title="$t('congregationAdd')"
            @click="createCong()"
          />
        </v-list>
      </v-col>
    </v-row>
  </div>
</template>
<script setup lang="ts">
import { platform, userInfo } from 'os'
import { basename, join } from 'upath'
import { pathExists } from 'fs-extra'
import { useIpcRenderer } from '@vueuse/electron'
import { useRouteQuery } from '@vueuse/router'
import * as fileWatcher from 'chokidar'
import type { LocaleObject } from '#i18n'
import type { CongPrefs, ObsPrefs, Theme, ZoomPrefs } from '~~/types'

interface Cong {
  id: string
  name: string
  path: string
  filename: string
}

const loading = ref(true)
const congs = ref<Cong[]>([])
const cong = useRouteQuery<string>('cong', '')
const loadCongs = async () => {
  loading.value = true
  congs.value = (await getCongPrefs()).map((c) => {
    return {
      id: c.id,
      name: c.name,
      path: c.path,
      filename: basename(c.path, '.json'),
    }
  })
  if (!cong.value) await autoSelectCong()
  loading.value = false
  log.debug('congs', congs.value)
}

onMounted(() => {
  useStatStore().setNavDisabled(true)
  if (!cong.value) {
    setTheme(prefersDark.value ? 'dark' : 'light')
  }
  loadCongs()
})

const createCong = () => {
  loading.value = true
  const id = Math.random().toString(36).substring(2, 15)
  initPrefs('prefs-' + id, true)
  loading.value = false
}

const autoSelectCong = async () => {
  if (congs.value.length === 0) {
    createCong()
  } else if (congs.value.length === 1) {
    initPrefs(basename(congs.value[0].path, '.json'))
  } else {
    const { default: getUsername } = await import('fullname')
    const username = (await getUsername()) ?? userInfo().username
    const match = congs.value.find(
      (c) => c.name.toLowerCase().trim() === username.toLowerCase().trim(),
    )
    if (match) {
      initPrefs(basename(match.path, '.json'))
    }
  }
}

const removeCong = (path: string) => {
  rm(path)
  loadCongs()
}

const watchers = ref<fileWatcher.FSWatcher[]>([])
onBeforeUnmount(() => {
  watchers.value.forEach((w) => w.close())
})

const { fallbackLocale, locales } = useI18n()
const { online } = storeToRefs(useStatStore())
const { prefersDark, setTheme } = useTheme()
const initPrefs = (name: string, isNew = false) => {
  const ipcRenderer = useIpcRenderer()
  initStore(name)
  const { $dayjs, $sentry } = useNuxtApp()

  // Set correct locale
  let lang = getPrefs<string>('app.localAppLang')
  if (!lang) {
    lang = useBrowserLocale() ?? fallbackLocale.value.toString()
    setPrefs('app.localAppLang', lang)
    log.debug(`Setting app lang to ${lang}`)
  }

  // Open home
  let path = useLocalePath()('/home', lang)

  // If new cong or invalid settings, open settings
  if (isNew || !mediaPath()) {
    path = useLocalePath()('/settings', lang)
  }

  useRouter().push({
    path,
    query: {
      cong: name.replace('prefs-', ''),
      new: isNew ? 'true' : undefined,
    },
  })

  useStatStore().setNavDisabled(false)

  const locale = (locales.value as LocaleObject[]).find((l) => l.code === lang)
  $dayjs.locale(locale?.dayjs ?? lang ?? 'en')

  // Set disabledHardwareAcceleration to user pref
  setHardwareAcceleration()

  // Set app theme
  const themePref = getPrefs<Theme>('app.theme')
  ipcRenderer.send('setTheme', themePref)
  if (themePref === 'system') {
    setTheme(prefersDark.value ? 'dark' : 'light')
  } else {
    setTheme(themePref)
  }

  // Setup Sentry context
  $sentry.setUser({
    username: getPrefs<string>('app.congregationName'),
  })

  $sentry.setContext('prefs', {
    ...getAllPrefs(),
    obs: getPrefs<ObsPrefs>('app.obs'),
    zoom: getPrefs<ZoomPrefs>('app.zoom'),
  })

  // Open or close the media window depending on prefs
  initMediaWindow()

  // Check if the app is available in the current media lang
  checkLangs(isNew)

  // Set runAtBoot depending on prefs and platform
  if (platform() !== 'linux') {
    ipcRenderer.send('runAtBoot', getPrefs<boolean>('app.autoRunAtBoot'))
  }

  // Set auto updater prefs
  ipcRenderer.send(
    'toggleAutoUpdate',
    !getPrefs<boolean>('app.disableAutoUpdate'),
  )

  ipcRenderer.send('toggleUpdateChannel', getPrefs<boolean>('app.betaUpdates'))
  if (online.value) {
    ipcRenderer.send('checkForUpdates')
  }

  // Set music shuffle shortcut if enabled
  if (getPrefs<boolean>('meeting.enableMusicButton')) {
    setShortcut({
      key: getPrefs<string>('meeting.shuffleShortcut'),
      fn: 'toggleMusicShuffle',
      scope: 'music',
    })
  }

  // If all cong fields are filled in, try to connect to the server
  connectWebDAV()

  // Connect to cloud sync if enabled
  connectCloudSync()

  // Connect to OBS depending on prefs
  useObsStore().clear()
  const { enable, port, password } = getPrefs<ObsPrefs>('app.obs')
  if (enable && port && password) {
    getScenes()
  }

  // Regular Cleanup
  cleanup()
}

const connectWebDAV = async () => {
  useCongStore().clear()
  if (!getPrefs<boolean>('app.offline')) {
    const { server, username, password, dir } = getPrefs<CongPrefs>('cong')
    if (server && username && password && dir) {
      const error = await connect(server, username, password, dir)
      if (error === 'success') {
        forcePrefs()
      } else {
        warn('errorWebdavLs', { identifier: dir })
      }
    }
  }

  watchers.value.push(
    fileWatcher
      .watch(
        join(
          appPath(),
          `custom-background-image-${getPrefs<string>(
            'app.congregationName',
          )}*`,
        ),
        {
          depth: 1,
          ignorePermissionErrors: true,
        },
      )
      .on('add', () => {
        refreshBackgroundImgPreview()
      })
      .on('change', () => {
        refreshBackgroundImgPreview()
      })
      .on('unlink', () => {
        refreshBackgroundImgPreview()
      }),
  )
}

const connectCloudSync = () => {
  if (getPrefs('cloud.enable') && getPrefs('cloud.path')) {
    // custom background image
    watchers.value.push(
      fileWatcher
        .watch(
          join(
            getPrefs('cloud.path'),
            'Settings',
            `custom-background-image-${getPrefs<string>(
              'app.congregationName',
            )}*`,
          ),
          {
            depth: 1,
            ignorePermissionErrors: true,
          },
        )
        .on('add', (backgroundImg) => {
          copy(backgroundImg, join(appPath(), basename(backgroundImg)))
        })
        .on('change', (backgroundImg) => {
          copy(backgroundImg, join(appPath(), basename(backgroundImg)))
        })
        .on('unlink', (backgroundImg) => {
          rm(join(appPath(), basename(backgroundImg)))
        }),
    )
    // enforced settings
    watchers.value.push(
      fileWatcher
        .watch(join(getPrefs('cloud.path'), 'Settings', 'forcedPrefs.json'), {
          depth: 1,
          ignorePermissionErrors: true,
        })
        .on('add', () => {
          forcePrefs()
        })
        .on('change', () => {
          forcePrefs()
        })
        .on('unlink', () => {
          forcePrefs()
        }),
    )
  }
}

const initMediaWindow = () => {
  const presentStore = usePresentStore()
  const enableMediaDisplayButton = getPrefs<boolean>(
    'media.enableMediaDisplayButton',
  )
  if (enableMediaDisplayButton && !presentStore.mediaScreenInit) {
    toggleMediaWindow('open')
  } else if (!enableMediaDisplayButton && presentStore.mediaScreenInit) {
    toggleMediaWindow('close')
  }
  useStatStore().setShowMediaPlayback(enableMediaDisplayButton)
}

const checkLangs = async (isNew: boolean) => {
  const langs = await getJWLangs()
  const mediaLang = langs.find(
    (l) => l.langcode === getPrefs<string>('media.lang'),
  )
  const appLang = langs.find(
    (l) => l.symbol === getPrefs<string>('app.localAppLang'),
  )

  if (
    isNew &&
    mediaLang &&
    !(locales.value as LocaleObject[])
      .map((l: any) => l.code)
      .includes(convertSignLang(mediaLang.symbol))
  ) {
    notify('wannaHelpExplain', {
      type: 'wannaHelp',
      identifier: `${mediaLang.name} (${mediaLang.langcode}/${mediaLang.symbol})`,
      action: {
        type: 'link',
        label: 'wannaHelpForSure',
        url: `${
          useRuntimeConfig().public.repo
        }/discussions/new?category=translations&title=New+translation+in+${
          mediaLang.name
        }&language=I+would+like+to+help+translate+M³+into+a+language+I+speak,+${
          mediaLang.name
        } (${mediaLang.langcode}/${mediaLang.symbol}).`,
      },
    })
  } else if (isNew && appLang && STALE_LANGS.includes(appLang.symbol)) {
    notify('wannaHelpExisting', {
      type: 'wannaHelp',
      identifier: `${appLang.name} (${appLang.langcode}/${appLang.symbol})`,
      action: {
        type: 'link',
        label: 'wannaHelpForSure',
        url: `${
          useRuntimeConfig().public.repo
        }/discussions/new?category=translations&title=New+translator+for+${
          appLang.name
        }&language=I+would+like+to+help+translate+M³+into+a+language+I+speak,+${
          appLang.name
        } (${appLang.langcode}/${appLang.symbol}).`,
      },
    })
  }
}

const setHardwareAcceleration = async () => {
  const ipcRenderer = useIpcRenderer()
  const disableHA = getPrefs<boolean>('app.disableHardwareAcceleration')
  const haPath = join(appPath(), 'disableHardwareAcceleration')
  const haExists = await pathExists(haPath)

  // Only do something if the value is not in sync with the presence of the file
  if (disableHA && !haExists) {
    write(haPath, '')
  } else if (!disableHA && haExists) {
    rm(haPath)
  }

  if (disableHA !== haExists) {
    ipcRenderer.send('restart')
  }
}
</script>
