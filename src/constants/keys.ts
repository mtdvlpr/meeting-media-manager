import type { PrefStore } from '~~/types'

// Provided by default layout
export const windowSizeKey = Symbol('windowSize') as InjectionKey<{
  width: Ref<number>
  height: Ref<number>
}>

// Provided by settings
export const prefsKey = Symbol('prefs') as InjectionKey<Ref<PrefStore>>
export const updatePrefsKey = Symbol('updatePrefs') as InjectionKey<
  (key: string, value: any) => {}
>
export const setProgressKey = Symbol('setProgress') as InjectionKey<
  (loaded: number, total: number, global?: boolean) => void
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
