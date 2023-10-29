import { ipcRenderer } from 'electron'
import Store, { type Schema } from 'electron-store'
import { sync } from 'fast-glob'
import { readJsonSync, removeSync } from 'fs-extra'
import { basename, dirname, join, joinSafe, normalizeSafe } from 'upath'
import type {
  AppPrefs,
  CongPrefs,
  PrefStore,
  MediaPrefs,
  MeetingPrefs,
  ObsPrefs,
} from '~~/types'

const schema: Schema<PrefStore> = {
  app: {
    type: 'object',
    properties: {
      theme: {
        type: 'string',
        enum: ENUMS.theme,
        default: PREFS.app.theme,
      },
      betaUpdates: {
        type: 'boolean',
        default: PREFS.app.betaUpdates,
      },
      disableAutoUpdate: {
        type: 'boolean',
        default: PREFS.app.disableAutoUpdate,
      },
      disableHardwareAcceleration: {
        type: 'boolean',
        default: PREFS.app.disableHardwareAcceleration,
      },
      localAppLang: {
        type: ['string', 'null'],
        default: PREFS.app.localAppLang,
      },
      customCachePath: {
        type: ['string', 'null'],
        default: PREFS.app.customCachePath,
      },
      localOutputPath: {
        type: ['string', 'null'],
        default: PREFS.app.localOutputPath,
      },
      congregationName: {
        type: ['string', 'null'],
        default: PREFS.app.congregationName,
      },
      offline: {
        type: 'boolean',
        default: PREFS.app.offline,
      },
      outputFolderDateFormat: {
        type: 'string',
        enum: ENUMS.outputFolderDateFormat,
        default: PREFS.app.outputFolderDateFormat,
      },
      // autoStartSync: {
      //   type: 'boolean',
      //   default: PREFS.app.autoStartSync,
      // },
      autoRunAtBoot: {
        type: 'boolean',
        default: PREFS.app.autoRunAtBoot,
      },
      autoQuitWhenDone: {
        type: 'boolean',
        default: PREFS.app.autoQuitWhenDone,
      },
      autoOpenFolderWhenDone: {
        type: 'boolean',
        default: PREFS.app.autoOpenFolderWhenDone,
      },
      obs: {
        type: 'object',
        properties: {
          enable: {
            type: 'boolean',
            default: PREFS.app.obs.enable,
          },
          port: {
            type: ['string', 'null'],
            default: PREFS.app.obs.port,
          },
          password: {
            type: ['string', 'null'],
            default: PREFS.app.obs.password,
          },
          mediaScene: {
            type: ['string', 'null'],
            default: PREFS.app.obs.mediaScene,
          },
          imageScene: {
            type: ['string', 'null'],
            default: PREFS.app.obs.imageScene,
          },
          cameraScene: {
            type: ['string', 'null'],
            default: PREFS.app.obs.cameraScene,
          },
          zoomScene: {
            type: ['string', 'null'],
            default: PREFS.app.obs.zoomScene,
          },
          useV4: {
            type: 'boolean',
            default: PREFS.app.obs.useV4,
          },
        },
      },
      zoom: {
        type: 'object',
        properties: {
          enable: {
            type: 'boolean',
            default: PREFS.app.zoom.enable,
          },
          name: {
            type: ['string', 'null'],
            default: PREFS.app.zoom.name,
          },
          id: {
            type: ['string', 'null'],
            default: PREFS.app.zoom.id,
          },
          password: {
            type: ['string', 'null'],
            default: PREFS.app.obs.password,
          },
          spotlight: {
            type: 'boolean',
            default: PREFS.app.zoom.spotlight,
          },
          autoRename: {
            type: 'array',
            default: PREFS.app.zoom.autoRename,
            items: {
              type: 'string',
            },
          },
          autoStartMeeting: {
            type: 'boolean',
            default: PREFS.app.zoom.autoStartMeeting,
          },
          autoStartTime: {
            type: 'number',
            minimum: 1,
            maximum: 10,
            default: PREFS.app.zoom.autoStartTime,
          },
        },
      },
    },
  },
  cloud: {
    type: 'object',
    properties: {
      enable: {
        type: 'boolean',
        default: PREFS.cloud.enable,
      },
      path: {
        type: ['string', 'null'],
        default: PREFS.cloud.path,
      },
    },
  },
  cong: {
    type: 'object',
    properties: {
      enable: {
        type: 'boolean',
        default: PREFS.cong.enable,
      },
      server: {
        type: ['string', 'null'],
        default: PREFS.cong.server,
      },
      username: {
        type: ['string', 'null'],
        default: PREFS.cong.username,
      },
      password: {
        type: ['string', 'null'],
        default: PREFS.cong.password,
      },
      port: {
        type: ['string', 'null'],
        default: PREFS.cong.port,
      },
      dir: {
        type: ['string', 'null'],
        default: PREFS.cong.dir,
      },
    },
  },
  media: {
    type: 'object',
    properties: {
      lang: {
        type: ['string', 'null'],
        default: PREFS.media.lang,
      },
      langFallback: {
        type: ['string', 'null'],
        default: PREFS.media.langFallback,
      },
      langSubs: {
        type: ['string', 'null'],
        default: PREFS.media.langSubs,
      },
      langUpdatedLast: {
        type: ['string', 'null'],
        default: PREFS.media.langUpdatedLast,
      },
      maxRes: {
        type: 'string',
        enum: ENUMS.maxRes,
        default: PREFS.media.maxRes,
      },
      enablePp: {
        type: 'boolean',
        default: PREFS.media.enablePp,
      },
      enableMp4Conversion: {
        type: 'boolean',
        default: PREFS.media.enableMp4Conversion,
      },
      enableSubtitles: {
        type: 'boolean',
        default: PREFS.media.enableSubtitles,
      },
      keepOriginalsAfterConversion: {
        type: 'boolean',
        default: PREFS.media.keepOriginalsAfterConversion,
      },
      enableVlcPlaylistCreation: {
        type: 'boolean',
        default: PREFS.media.enableVlcPlaylistCreation,
      },
      enableMediaDisplayButton: {
        type: 'boolean',
        default: PREFS.media.enableMediaDisplayButton,
      },
      hideMediaLogo: {
        type: 'boolean',
        default: PREFS.media.hideMediaLogo,
      },
      hideWinAfterMedia: {
        type: 'boolean',
        default: PREFS.media.hideWinAfterMedia,
      },
      autoPlayFirst: {
        type: 'boolean',
        default: PREFS.media.autoPlayFirst,
      },
      autoPlayFirstTime: {
        type: 'number',
        default: PREFS.media.autoPlayFirstTime,
        minimum: 1,
        maximum: 15,
      },
      includePrinted: {
        type: 'boolean',
        default: PREFS.media.includePrinted,
      },
      excludeTh: {
        type: 'boolean',
        default: PREFS.media.excludeTh,
      },
      excludeFootnotes: {
        type: 'boolean',
        default: PREFS.media.excludeFootnotes,
      },
      excludeLffImages: {
        type: 'boolean',
        default: PREFS.media.excludeLffImages,
      },
      ppBackward: {
        type: ['string', 'null'],
        default: PREFS.media.ppBackward,
      },
      ppForward: {
        type: ['string', 'null'],
        default: PREFS.media.ppForward,
      },
      preferredOutput: {
        oneOf: [{ type: 'string' }, { type: 'number' }],
        default: PREFS.media.preferredOutput,
      },
      mediaWinShortcut: {
        type: 'string',
        default: PREFS.media.mediaWinShortcut,
      },
      presentShortcut: {
        type: 'string',
        default: PREFS.media.presentShortcut,
      },
    },
  },
  meeting: {
    type: 'object',
    properties: {
      autoStartMusic: {
        type: 'boolean',
        default: PREFS.meeting.autoStartMusic,
      },
      enableMusicButton: {
        type: 'boolean',
        default: PREFS.meeting.enableMusicButton,
      },
      shuffleShortcut: {
        type: 'string',
        default: PREFS.meeting.shuffleShortcut,
      },
      enableMusicFadeOut: {
        type: 'boolean',
        default: PREFS.meeting.enableMusicFadeOut,
      },
      mwDay: {
        type: ['number', 'null'],
        minimum: 0,
        maximum: 6,
        default: PREFS.meeting.mwDay,
      },
      specialCong: {
        type: 'boolean',
        default: PREFS.meeting.specialCong,
      },
      coWeek: {
        type: ['string', 'null'],
        default: PREFS.meeting.coWeek,
      },
      weDay: {
        type: ['number', 'null'],
        minimum: 0,
        maximum: 6,
        default: PREFS.meeting.weDay,
      },
      musicFadeOutType: {
        type: 'string',
        enum: ENUMS.musicFadeOutType,
        default: PREFS.meeting.musicFadeOutType,
      },
      musicFadeOutTime: {
        type: 'number',
        minimum: 5,
        maximum: 60,
        multipleOf: 5,
        default: PREFS.meeting.musicFadeOutTime,
      },
      musicVolume: {
        type: 'number',
        minimum: 1,
        maximum: 100,
        default: PREFS.meeting.musicVolume,
      },
      mwStartTime: {
        type: ['string', 'null'],
        default: PREFS.meeting.mwStartTime,
      },
      weStartTime: {
        type: ['string', 'null'],
        default: PREFS.meeting.weStartTime,
      },
    },
  },
}

let store: Store<PrefStore> | undefined

function storeOptions(name = 'prefs'): Store.Options<PrefStore> {
  return {
    name,
    schema,
    defaults: PREFS,
    beforeEachMigration: (_store, context) => {
      log.debug(
        `[main-config] migrate from ${context.fromVersion} → ${context.toVersion}`,
      )
      log.debug(`[main-config] final version: ${context.finalVersion}`)
      log.debug(`[main-config] versions: ${context.versions}`)
    },
    migrations: {
      '0.0.1': (store) => {
        for (const key of Object.keys(store.store)) {
          // Skip root keys
          if (
            key === 'app' ||
            key === 'cong' ||
            key === 'cloud' ||
            key === 'media' ||
            key === 'meeting' ||
            key === '__internal__'
          ) {
            continue
          }

          log.debug(
            `Processing ${key}=${store.get(key)} (${typeof store.get(key)})...`,
          )

          try {
            const newProp = migrate2290(key, store.get(key))

            // Set new key and value and delete old one
            store.set(newProp.key, newProp.val)
            store.delete(key as keyof PrefStore)

            // @ts-expect-error: 'cong.port' is not defined as a key of PrefStore
            store.reset('cong.port')
          } catch (e) {
            log.error(e)
          }
        }
      },
      '22.10.1': (store) => {
        if (store.get('app.ppEnable') !== undefined) {
          store.set(
            'media.enablePp',
            store.get('app.ppEnable') || store.get('media.enablePp'),
          )
          // @ts-expect-error: 'app.ppEnable' is not defined as a key of PrefStore
          store.delete('app.ppEnable')
        }
      },
      '22.12.0': (store) => {
        if (store.get('app.localAdditionalMediaPrompt') !== undefined) {
          // @ts-expect-error: 'app.localAdditionalMediaPrompt' is not defined as a key of PrefStore
          store.delete('app.localAdditionalMediaPrompt')
        }
      },
      '23.1.0': (store) => {
        if (store.get('media.excludeLffi') !== undefined) {
          // @ts-expect-error: 'app.excludeLffi' is not defined as a key of PrefStore
          store.delete('media.excludeLffi')
        }
        const excludeLffiImages = store.get('media.excludeLffiImages')
        if (excludeLffiImages !== undefined) {
          store.set('media.excludeLffImages', excludeLffiImages)
          // @ts-expect-error: 'app.excludeLffiImages' is not defined as a key of PrefStore
          store.delete('media.excludeLffiImages')
        }
      },
      '23.4.0': (store) => {
        if (store.get('cong.user') !== undefined) {
          store.set('cong.username', store.get('cong.user'))
          // @ts-expect-error: 'cong.user' is not defined as a key of PrefStore
          store.delete('cong.user')
        }
        const { server, username, password, dir } = store.get('cong')
        if (server && username && password && dir) {
          store.set('cong.enable', true)
        }
      },
    },
  }
}

export function migrate2290(key: string, newVal: any) {
  let isObsPref = false
  let isMeetingPref = false
  let isMediaPref = false
  let isCongPref = false

  let root: keyof PrefStore = 'app'
  let newKey:
    | keyof AppPrefs
    | keyof MeetingPrefs
    | keyof MediaPrefs
    | keyof CongPrefs
    | keyof ObsPrefs = key as any

  // Get correct values for root, newKey and newVal
  if (key === 'enableObs') {
    isObsPref = true
    newKey = 'enable'
  } else if (key === 'ppEnable') {
    newKey = 'enablePp'
    root = 'media'
    isMediaPref = true
  } else if (key.startsWith('obs')) {
    isObsPref = true
    newKey = key.replace('obs', '') as keyof ObsPrefs
    newKey = (newKey.charAt(0).toLowerCase() +
      newKey.slice(1)) as keyof ObsPrefs
  } else if (key.startsWith('congServer')) {
    root = 'cong'
    isCongPref = true
    newKey = key
      .replace('congServer', 'server')
      .replace('serverDir', 'dir')
      .replace('serverPass', 'password')
      .replace('serverPort', 'port')
      .replace('serverUser', 'user') as keyof CongPrefs
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  } else if (PREFS.media[key as keyof MediaPrefs] !== undefined) {
    root = 'media'
    isMediaPref = true
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  } else if (PREFS.meeting[key as keyof MeetingPrefs] !== undefined) {
    root = 'meeting'
    isMeetingPref = true
  }

  function setDefaultValue() {
    if (isObsPref) {
      newVal = PREFS.app.obs[newKey as keyof ObsPrefs]
    } else if (isMeetingPref) {
      newVal = PREFS.meeting[newKey as keyof MeetingPrefs]
    } else if (isMediaPref) {
      newVal = PREFS.media[newKey as keyof MediaPrefs]
    } else if (isCongPref) {
      newVal = PREFS.cong[newKey as keyof CongPrefs]
    } else {
      newVal = PREFS.app[newKey as keyof AppPrefs]
    }
  }

  // Convert null values to (new) default values
  if (newVal === null || newVal === undefined) {
    setDefaultValue()
  }

  // Validate preferredOutput
  if (key === 'preferredOutput') {
    if (typeof newVal === 'string' && newVal !== 'window') {
      setDefaultValue()
    }
  }

  // Validate enums
  const match = ENUMS[key as keyof typeof ENUMS]
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (match && !match.includes(newVal)) {
    setDefaultValue()
  }

  // Values that were converted from number to string
  if (key === 'congServerPort') {
    try {
      newVal = newVal.toString()
    } catch (e) {
      setDefaultValue()
    }
  }

  // Values that were converted from string to number
  if (
    key === 'musicFadeOutTime' ||
    key === 'musicVolume' ||
    key === 'mwDay' ||
    key === 'weDay'
  ) {
    if (typeof newVal === 'string') {
      try {
        newVal = parseInt(newVal)
        if (isNaN(newVal)) {
          setDefaultValue()
        }
      } catch (e) {
        setDefaultValue()
      }
    }
  }

  // Final check against the schema
  const schemaType = isObsPref
    ? // @ts-expect-error: newkey is not defined as a key of properties
      schema.app.properties?.obs?.properties[newKey]?.type
    : // @ts-expect-error: newkey is not defined as a key of properties
      schema[root].properties[newKey].type
  if (schemaType) {
    if (typeof schemaType === 'string') {
      if (typeof newVal !== 'string') {
        setDefaultValue()
      }
    } else if (
      !schemaType
        .map((t: string) => t.replace('null', 'object'))
        .includes(typeof newVal)
    ) {
      setDefaultValue()
    }
  }

  if (isObsPref) {
    return { key: `${root}.obs.${newKey}`, val: newVal }
  } else {
    return { key: `${root}.${newKey}`, val: newVal }
  }
}

export async function getCongPrefs() {
  return sync(join(await ipcRenderer.invoke('userData'), 'prefs-*.json'))
    .map((file) => {
      const prefs = readJsonSync(file) as PrefStore
      return {
        id: basename(file, '.json').replace('prefs-', ''),
        name:
          // @ts-expect-error: 'app.congregationName' is not defined as a key of PrefStore
          prefs.app.congregationName ?? (prefs.congregationName as string),
        path: file,
      }
    })
    .filter((cong) => !!cong.name)
    .sort((a, b) => b.name.localeCompare(a.name))
}

export function storePath() {
  return store?.path ? normalizeSafe(store.path) : undefined
}

export function initStore(name: string) {
  try {
    store = new Store<PrefStore>(storeOptions(name))
  } catch (e) {
    log.debug('Resetting the store...')
    const tempStore = new Store<PrefStore>(storeOptions('temp'))
    removeSync(joinSafe(dirname(tempStore.path), `${name}.json`))
    store = new Store<PrefStore>(storeOptions(name))
    removeSync(normalizeSafe(tempStore.path))

    useNuxtApp().$sentry.captureException(e)
  }
}

export function setPrefs(key: string, value: any) {
  if (!store) return
  store.set(key, value)
  const prefs = readJsonSync(store.path) as PrefStore
  useNuxtApp().$sentry.setContext('prefs', {
    ...prefs,
    obs: prefs.app.obs,
  })
  return prefs
}

export function prefsInitialized() {
  return !!store
}

export function switchCong(path: string) {
  initStore(basename(path, '.json'))
}

export function getPrefs<T = unknown>(key: string) {
  return store?.get(key) as T
}

export function getAllPrefs() {
  return store ? (readJsonSync(store.path) as PrefStore) : PREFS
}

export function setAllPrefs(prefs: PrefStore) {
  store?.set(prefs)
}
