<template>
  <base-layout>
    <template #top>
      <v-app-bar>
        <v-app-bar-title>{{ $t('settings') }}</v-app-bar-title>
        <progress-bar
          :current="relativeDownloadProgress"
          :total="totalProgress"
        />
        <template #extension>
          <v-tabs v-model="tab">
            <v-tab>{{ $t('all') }}</v-tab>
            <v-tab
              v-for="h in headers"
              :key="h.key"
              :prepend-icon="h.icon"
              :text="getInitials(h.name)"
              :disabled="!mounted"
              :class="{ 'text-error': !!mounted && !h.valid }"
            />
          </v-tabs>
        </template>
      </v-app-bar>
    </template>
    <slot />
    <template #bottom>
      <settings-footer
        :prefs="prefs"
        :mounting="!mounted"
        :valid="valid"
        :cache="cache"
        :refresh="refresh"
        @cache="cache = $event"
      />
    </template>
  </base-layout>
</template>
<script setup lang="ts">
import type { PrefStore } from '~~/types'

const { totalProgress, setProgress, relativeDownloadProgress } = useProgress()
provide(setProgressKey, setProgress)

// Cache
const cache = ref(0)
const refresh = ref(false)
const calcCache = () => (refresh.value = !refresh.value)
provide(settingsCacheKey, cache)
provide(settingsCalcCacheKey, calcCache)

// Prefs
const prefs = ref<PrefStore>({ ...DEFAULT_PREFS })
provide(settingsPrefsKey, prefs)
watch(prefs, () => calcCache(), { deep: true })

// Headers
const mounted = ref(false)
provide(settingsMountedKey, mounted)

const panel = ref(['app', 'cong', 'media', 'meeting'])
provide(settingsPanelKey, panel)

const valid = computed(() => headers.value.every((h) => h.valid))
provide(settingsValidKey, valid)

const { t } = useI18n()
const headers = ref<
  { key: keyof PrefStore; icon: string; name: string; valid?: boolean }[]
>([
  {
    key: 'app',
    icon: 'i-mdi:application',
    name: t('optionsApp'),
  },
  {
    key: 'cong',
    icon: 'i-mdi:cloud',
    name: t('optionsCongSync'),
  },
  {
    key: 'media',
    icon: 'i-mdi:multimedia',
    name: t('optionsMedia'),
  },
  {
    key: 'meeting',
    icon: 'i-mdi:lectern',
    name: t('optionsMeetings'),
  },
])
provide(settingsHeadersKey, headers)

watch(
  headers,
  (val) => {
    val.forEach((h) => {
      const match = panel.value.indexOf(h.key)
      if (!h.valid && match === -1) {
        panel.value.push(h.key)
      } else if (!mounted.value && h.valid && match > -1) {
        if (tab.value === 0) {
          panel.value.splice(match, 1)
        }
      }
    })
    mounted.value ||= valid.value || val.every((h) => h.valid !== undefined)
  },
  { deep: true },
)

// Header tabs
const tab = ref(0)
provide(settingsTabKey, tab)
const getInitials = (word: string) => {
  return word
    .split(' ')
    .map((w) => w[0])
    .join('')
}
</script>
