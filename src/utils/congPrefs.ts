import { join } from 'upath'
import type {
  ObsPrefs,
  AppPrefs,
  CongPrefs,
  MediaPrefs,
  MeetingPrefs,
  PrefStore,
  ZoomPrefs,
} from '~~/types'

export function isLocked(key: string) {
  const store = useCongStore()
  // If no forced prefs, don't lock
  if (!store.prefs) return false

  // If pref is not forcible, don't lock
  if (!FORCIBLE.includes(key)) return false

  const keys = key.split('.')

  // If app key is not in forcedPrefs, don't lock
  if (!store.prefs[keys[0] as keyof PrefStore]) return false

  if (keys.length === 2) {
    // @ts-expect-error
    return store.prefs[keys[0]][keys[1]] !== undefined
  }
  // If pref is in a sub object (e.g. app.obs.enable)
  else if (keys.length === 3) {
    // @ts-expect-error
    if (!store.prefs[keys[0]][keys[1]]) {
      return false
    }
    // @ts-expect-error
    return store.prefs[keys[0]][keys[1]][keys[2]] !== undefined
  } else {
    throw new Error('Invalid key')
  }
}

export async function forcePrefs(refresh = false) {
  const store = useCongStore()
  const client = store.client
  if (!client) return null
  if (!refresh && store.prefs) {
    return store.prefs
  }

  const dir = getPrefs<string>('cong.dir')
  if (!dir) return undefined

  try {
    const path = join(dir, 'forcedPrefs.json')
    if (store.contents.find(({ filename }) => filename === path)) {
      const json = await client.getFileContents(path, {
        format: 'text',
      })

      const prefs = JSON.parse(<string>json)

      // Migration of old pref structures
      for (const key of Object.keys(prefs)) {
        // Skip root keys
        if (
          key === 'app' ||
          key === 'cong' ||
          key === 'media' ||
          key === 'meeting' ||
          key === '__internal__'
        ) {
          continue
        }

        const newProp = migrate2290(key, prefs[key])
        delete prefs[key]

        const keys = newProp.key.split('.')
        if (!prefs[keys[0]]) prefs[keys[0]] = {}
        if (keys.length === 2) {
          prefs[keys[0]][keys[1]] = newProp.val
        } else if (keys.length === 3) {
          if (!prefs[keys[0]][keys[1]]) prefs[keys[0]][keys[1]] = {}
          prefs[keys[0]][keys[1]][keys[2]] = newProp.val
        }
      }

      if (prefs.media?.excludeLffi !== undefined) {
        delete prefs.media.excludeLffi
      }

      if (prefs.media?.excludeLffiImages !== undefined) {
        prefs.media.excludeLffImages = cloneDeep(prefs.media.excludeLffiImages)
        delete prefs.media.excludeLffiImages
      }

      const forcedPrefs = cloneDeep(prefs)

      if (!prefs.app) prefs.app = {}
      prefs.app.obs = Object.assign(
        getPrefs<ObsPrefs | null>('app.obs') ?? {},
        prefs.app.obs ?? {},
      )
      prefs.app.zoom = Object.assign(
        getPrefs<ZoomPrefs | null>('app.zoom') ?? {},
        prefs.app.zoom ?? {},
      )
      const newPrefs = {
        app: Object.assign(getPrefs<AppPrefs>('app'), prefs.app ?? {}),
        cong: Object.assign(getPrefs<CongPrefs>('cong'), prefs.cong ?? {}),
        media: Object.assign(getPrefs<MediaPrefs>('media'), prefs.media ?? {}),
        meeting: Object.assign(
          getPrefs<MeetingPrefs>('meeting'),
          prefs.meeting ?? {},
        ),
      }
      setAllPrefs(newPrefs)
      store.prefs = JSON.parse(JSON.stringify(forcedPrefs))
    }
  } catch (e: any) {
    error('errorForcedSettingsEnforce', e)
  }
}
