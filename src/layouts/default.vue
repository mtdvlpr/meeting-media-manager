<template>
  <v-app>
    <notify-user />
    <confirm-dialog
      v-model="dialog"
      description="quitWhilePresenting"
      @cancel="dialog = false"
      @confirm="quitApp()"
    />
    <navigation-drawer />
    <v-main scrollable>
      <slot />
    </v-main>
  </v-app>
</template>
<script setup lang="ts">
import { fileURLToPath, pathToFileURL } from 'url'
import { ipcRenderer } from 'electron'
import { useIpcRendererOn } from '@vueuse/electron'
import { join } from 'upath'
import type { Theme } from '~~/types'

const statStore = useStatStore()
const windowSize = useWindowSize()
provide(windowSizeKey, windowSize)

const initMediaWinState = async () => {
  const mediaWinOpen = await ipcRenderer.invoke('mediaWinOpen')
  const presentStore = usePresentStore()
  presentStore.setMediaScreenInit(mediaWinOpen)
  if (mediaWinOpen) {
    const mediaWinVisible = await ipcRenderer.invoke('mediaWinVisible')
    presentStore.setMediaScreenVisible(mediaWinVisible)
  }
}

onMounted(() => {
  log.debug('sentry', useRuntimeConfig().public.sentryEnabled)
  initMediaWinState()
  statStore.setOnline(navigator.onLine)
})

// Online/offline
const { online } = storeToRefs(statStore)
watch(online, (val) => {
  if (val) {
    useNotifyStore().dismissByMessage('errorOffline')
  } else {
    warn('errorOffline')
  }
})
useEventListener('online', () => {
  statStore.setOnline(true)
})
useEventListener('offline', () => {
  statStore.setOnline(false)
})

// Global Theme
const { prefersDark, setTheme } = useTheme()
watch(prefersDark, (val) => {
  if (getPrefs<Theme>('app.theme') === 'system') {
    setTheme(val ? 'dark' : 'light')
  }
})

// Global listeners
useIpcRendererOn('readyToListen', () => {
  ipcRenderer.send('startMediaDisplay', getAllPrefs())
})
useIpcRendererOn('toggleMusicShuffle', () => {
  shuffleMusic(!!useMediaStore().musicFadeOut)
})
useIpcRendererOn('themeUpdated', (_e, theme: string) => {
  if (getPrefs<Theme>('app.theme') === 'system') {
    setTheme(theme)
  }
})
useIpcRendererOn('log', (_e, msg) => {
  log.debug('[main]', msg)
})

const dialog = ref(false)
const quitApp = () => {
  ipcRenderer.send('exit')
}
useIpcRendererOn('notifyUser', (_e, msg: any[]) => {
  if (msg[0] === 'cantCloseMediaWindowOpen') {
    dialog.value = true
  } else if (msg[0]) {
    notify(msg[0], msg[1], msg[3])
  } else {
    log.warn('Notify message is empty: ', msg)
  }
  if (msg[0] === 'updateNotDownloaded') {
    statStore.setUpdateSuccess(false)
  }
})

// Presentation Mode
useIpcRendererOn('openPresentMode', () => {
  const localePath = useLocalePath()
  if (
    getPrefs<boolean>('media.enableMediaDisplayButton') &&
    useRoute().path !== localePath('/present')
  ) {
    log.debug('Trigger present mode via shortcut')
    useRouter().push({
      path: localePath('/present'),
      query: useRoute().query,
    })
  }
})

useIpcRendererOn('mediaWindowShown', () => {
  usePresentStore().setMediaScreenInit(true)
  ipcRenderer.send('startMediaDisplay', getAllPrefs())
})
useIpcRendererOn('mediaWindowVisibilityChanged', (_e, status: string) => {
  usePresentStore().setMediaScreenVisible(status === 'shown')
})
useIpcRendererOn('displaysChanged', async () => {
  if (usePresentStore().mediaScreenInit) {
    ipcRenderer.send('showMediaWindow', await getMediaWindowDestination())
  }
})
useIpcRendererOn('moveMediaWindowToOtherScreen', async () => {
  if (usePresentStore().mediaScreenInit) {
    ipcRenderer.send('showMediaWindow', await getMediaWindowDestination())
  }
})

// MacOS update
useIpcRendererOn('macUpdate', async (_e, version) => {
  try {
    const release = await fetchRelease(`releases/tags/${version}`)

    const macDownload = release.assets.find(({ name }) => name.includes('dmg'))!

    notify('updateDownloading', {
      identifier: release.tag_name,
    })

    const downloadsPath = join(
      (await ipcRenderer.invoke('downloads')) as string,
      macDownload.name,
    )

    // Download the latest release
    await fetchFile({
      url: macDownload.browser_download_url,
      dest: downloadsPath,
    })

    // Open the downloaded file
    ipcRenderer.send(
      'openPath',
      fileURLToPath(pathToFileURL(downloadsPath).href),
    )
  } catch (e) {
    error('updateNotDownloaded', e)
    statStore.setUpdateSuccess(false)
  }
})
</script>
