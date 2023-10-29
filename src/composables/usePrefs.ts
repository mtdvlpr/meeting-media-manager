import type {
  AppPrefs,
  CongPrefs,
  MediaPrefs,
  MeetingPrefs,
  PrefStore,
} from '~~/types'

export default function <
  T extends AppPrefs | CongPrefs | MediaPrefs | MeetingPrefs,
>(scope: keyof PrefStore, emit: { (e: 'refresh', val: T): void }) {
  const prefs = ref<T>(getPrefs<T>(scope)) as Ref<T>
  watch(
    prefs,
    (val) => {
      setPrefs(scope, val)
      emit('refresh', val)
    },
    { deep: true },
  )

  const { client, prefs: forcedPrefs } = storeToRefs(useCongStore())
  watch(forcedPrefs, () => (prefs.value = getPrefs<T>(scope)))
  onMounted(() => {
    emit('refresh', prefs.value)
  })

  return { prefs, client }
}
