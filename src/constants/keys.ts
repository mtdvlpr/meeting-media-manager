import type { PrefStore } from '~~/types'

// Provided by default layout
export const windowSizeKey = Symbol('windowSize') as InjectionKey<{
  width: Ref<number>
  height: Ref<number>
}>

// Provided by multiple layouts
export const setProgressKey = Symbol('setProgress') as InjectionKey<
  (loaded: number, total: number, global?: boolean) => void
>

// Provided by home layout
export const currentWeekKey = Symbol('currentWeek') as InjectionKey<Ref<number>>
export const upcomingWeeksKey = Symbol('upcomingWeeks') as InjectionKey<
  ComputedRef<{ label: string; iso: number }[]>
>

// Provided by settings layout
export const settingsCacheKey = Symbol('settingsCache') as InjectionKey<
  Ref<number>
>
export const settingsCalcCacheKey = Symbol('settingsCalcCache') as InjectionKey<
  () => boolean
>
export const settingsPrefsKey = Symbol('settingsPrefs') as InjectionKey<
  Ref<PrefStore>
>
export const settingsMountedKey = Symbol('settingsMounted') as InjectionKey<
  Ref<boolean>
>
export const settingsValidKey = Symbol('settingsValid') as InjectionKey<
  ComputedRef<boolean>
>
export const settingsTabKey = Symbol('settingsTab') as InjectionKey<Ref<number>>
export const settingsPanelKey = Symbol('settingsPanel') as InjectionKey<
  Ref<string[]>
>
export const settingsHeadersKey = Symbol('settingsHeaders') as InjectionKey<
  Ref<{ key: keyof PrefStore; icon: string; name: string; valid?: boolean }[]>
>
export const prefsKey = Symbol('prefs') as InjectionKey<Ref<PrefStore>>
export const updatePrefsKey = Symbol('updatePrefs') as InjectionKey<
  (key: string, value: any) => {}
>

// Provided by present page
export const zoomPartKey = Symbol('zoomPart') as InjectionKey<Ref<boolean>>
export const mediaActiveKey = Symbol('mediaActive') as InjectionKey<
  Ref<boolean>
>
export const videoActiveKey = Symbol('videoActive') as InjectionKey<
  Ref<boolean>
>

// Provided by media controls
export const ccEnableKey = Symbol('ccEnable') as InjectionKey<Ref<boolean>>
export const showPrefixKey = Symbol('showPrefix') as InjectionKey<Ref<boolean>>
