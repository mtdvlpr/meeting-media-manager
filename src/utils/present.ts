import { pathToFileURL } from 'url'
import { ipcRenderer } from 'electron'
import { join, basename } from 'upath'
import type { ShortcutScope } from './../../types/electron.d'
import type {
  MediaPrefs,
  ScreenInfo,
  MediaWinOptions,
  Shortcut,
  ShortcutAction,
} from '~~/types'

export async function setShortcut({ key, fn, scope }: Shortcut) {
  if (!scope) scope = 'mediaWin'
  let res = false
  const store = usePresentStore()
  const shortcuts = store.shortcuts
  try {
    const match = shortcuts.find((s) => s.key === key)
    if (match) {
      res = match.scope === scope && match.fn === fn
    } else if (key) {
      store.addShortcut({ key, scope, fn })
      res = await ipcRenderer.invoke('registerShortcut', {
        key,
        fn,
      })
    }
  } catch (e) {
    log.error(e)
  } finally {
    if (!res && key) {
      notify('infoShortcutSetFail', { identifier: key })
    }
  }
}

export function changeShortcut(key: string | null, fn: ShortcutAction) {
  if (!key) return
  if (isShortcutValid(key) && isShortcutAvailable(key, fn)) {
    unsetShortcut(fn)
    setShortcut({ key, fn })
  }
}
export function getShortcutRules(fn: ShortcutAction) {
  const { t } = useNuxtApp().$i18n
  return [
    (v: string) => isShortcutValid(v) || t('fieldShortcutInvalid'),
    (v: string) => isShortcutAvailable(v, fn) || t('fieldShortcutTaken'),
  ]
}

function isShortcutAvailable(key: string, fn: ShortcutAction) {
  const { ppForward, ppBackward, mediaWinShortcut, presentShortcut } =
    getPrefs<MediaPrefs>('media')

  // Alt+[number] is reserved for OBS scenes
  if (/Alt\+\d+/.test(key)) return false

  const shortcuts: Shortcut[] = [
    { key: ppForward!, fn: 'nextMediaItem' },
    { key: ppBackward!, fn: 'previousMediaItem' },
    { key: mediaWinShortcut!, fn: 'toggleMediaWindow' },
    { key: presentShortcut!, fn: 'openPresentMode' },
    {
      key: getPrefs<string>('meeting.shuffleShortcut'),
      fn: 'toggleMusicShuffle',
    },
  ]

  return !shortcuts.find((s) => s.key === key && s.fn !== fn)
}

function isShortcutValid(key: string) {
  if (!key) return false

  const modifiers =
    /^(Command|Cmd|Control|Ctrl|CommandOrControl|CmdOrCtrl|Alt|Option|AltGr|Shift|Super)$/
  const keyCodes =
    /^([0-9A-Z)!@#%^&*(:+<_>?~{|}";=,\-./`[\\\]']|F1*[1-9]|F10|F2[0-4]|Plus|Space|Tab|Backspace|Delete|Insert|Return|Enter|Up|Down|Left|Right|Home|End|PageUp|PageDown|Escape|Esc|VolumeUp|VolumeDown|VolumeMute|MediaNextTrack|MediaPreviousTrack|MediaStop|MediaPlayPause|PrintScreen)$/

  const parts = key.split('+')
  let keyFound = false

  return parts.every((val, index) => {
    const isKey = keyCodes.test(val)
    const isModifier = modifiers.test(val)
    if (isKey) {
      // Key must be unique
      if (keyFound) return false
      keyFound = true
    }

    // Key is required
    if (index === parts.length - 1 && !keyFound) return false
    return isKey || isModifier
  })
}

export function unsetShortcut(fn: ShortcutAction) {
  const store = usePresentStore()
  const shortcuts = store.shortcuts

  const match = shortcuts.find((s) => fn === s.fn)

  if (!match) return

  try {
    ipcRenderer.send('unregisterShortcut', match.key)
  } catch (e) {
    log.error(e)
  }

  store.shortcuts = shortcuts.filter(({ key }) => key !== match.key)
}

export function unsetShortcuts(filter: ShortcutScope | 'all' = 'all') {
  const store = usePresentStore()
  const shortcuts = store.shortcuts
  const keepers: typeof shortcuts = []

  for (let i = shortcuts.length - 1; i >= 0; i--) {
    const { key, scope } = shortcuts[i]
    if (filter === 'all' || scope === filter) {
      try {
        ipcRenderer.send('unregisterShortcut', key)
      } catch (e) {
        log.error(e)
      }
    } else {
      keepers.push({ ...shortcuts[i] })
    }
  }
  store.shortcuts = keepers
}

export async function showMediaWindow() {
  ipcRenderer.send('showMediaWindow', await getMediaWindowDestination())
  setShortcut({
    key: getPrefs<string>('media.presentShortcut'),
    fn: 'openPresentMode',
  })
  setShortcut({
    key: getPrefs<string>('media.mediaWinShortcut'),
    fn: 'toggleMediaWindow',
  })
}

export function closeMediaWindow() {
  unsetShortcuts('mediaWin')
  ipcRenderer.send('closeMediaWindow')
  usePresentStore().mediaScreenInit = false
}

export async function toggleMediaWindow(action?: string) {
  if (!action) {
    action = getPrefs<boolean>('media.enableMediaDisplayButton')
      ? 'open'
      : 'close'
  }
  if (action === 'open') {
    await showMediaWindow()
  } else {
    closeMediaWindow()
    if (action === 'reopen') toggleMediaWindow()
  }
}

export async function refreshBackgroundImgPreview(force = false) {
  if (!getPrefs<boolean>('media.enableMediaDisplayButton')) return ''

  try {
    let type = 'yeartext'
    const backgrounds = findAll(
      join(
        appPath(),
        `custom-background-image-${getPrefs<string>('app.congregationName')}*`,
      ),
    )

    const store = usePresentStore()

    // If no custom background, set yeartext as background
    if (backgrounds.length === 0) {
      const yeartext = await getYearText(force)
      const root = document.createElement('div')
      root.innerHTML = yeartext ?? ''
      let yeartextString = ''
      for (let i = 0; i < root.children.length; i++) {
        yeartextString += '<p>' + root.children.item(i)?.textContent + '</p>'
      }
      store.background = yeartextString
    } else {
      const response = await $fetch.raw<BlobPart>(
        pathToFileURL(backgrounds[0]).href,
        {
          responseType: 'blob',
        },
      )
      const file = new File([response._data!], basename(backgrounds[0]), {
        type: response.headers.get('content-type') ?? undefined,
      })

      URL.revokeObjectURL(usePresentStore().background)
      store.background = URL.createObjectURL(file)
      type = 'custom'
    }
    ipcRenderer.send('startMediaDisplay', getAllPrefs())
    return type
  } catch (e) {
    log.error(e)
  }
  return ''
}

export async function getMediaWindowDestination() {
  const mediaWinOptions: MediaWinOptions = {
    destination: null,
    type: 'window',
  }

  if (!getPrefs<boolean>('media.enableMediaDisplayButton'))
    return mediaWinOptions

  try {
    const store = usePresentStore()
    const { t } = useNuxtApp().$i18n
    const screenInfo = (await ipcRenderer.invoke('getScreenInfo')) as ScreenInfo
    store.screens = screenInfo.otherScreens.map((screen) => {
      return {
        id: screen.id,
        class: 'display',
        title: `${t('screen')} ${screen.humanFriendlyNumber} ${
          screen.size.width && screen.size.height
            ? ` (${screen.size.width}x${screen.size.height}) (ID: ${screen.id})`
            : ''
        }`,
      }
    })

    const output = getPrefs<number | 'window'>('media.preferredOutput')
    if (output !== 'window' && screenInfo.otherScreens.length > 0) {
      const pref = screenInfo.otherScreens.find((d) => d.id === output)
      mediaWinOptions.destination =
        pref?.id ??
        screenInfo.otherScreens[screenInfo.otherScreens.length - 1].id
      mediaWinOptions.type = 'fullscreen'
    } else {
      mediaWinOptions.destination = screenInfo.displays[0]?.id ?? null
    }
  } catch (e) {
    log.error(e)
  }
  return mediaWinOptions
}
