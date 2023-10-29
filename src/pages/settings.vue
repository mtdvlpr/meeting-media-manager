<template>
  <div>
    <v-app-bar>
      <v-app-bar-title>{{ $t('settings') }}</v-app-bar-title>
      <progress-bar
        :current="relativeDownloadProgress"
        :total="totalProgress"
      />
      <template #extension>
        <v-tabs v-model="tab" grow>
          <v-tab>{{ $t('all') }}</v-tab>
          <v-tab
            v-for="h in headers"
            :key="h.key"
            :disabled="!mounted"
            :class="{ 'text-error': !!mounted && !h.valid }"
          >
            <v-icon :icon="h.icon" start />
            {{ getInitials(h.name) }}
          </v-tab>
        </v-tabs>
      </template>
    </v-app-bar>
    <v-row no-gutters justify="center" class="fill-height settings">
      <v-col cols="12" :style="`overflow:auto;max-height: ${contentHeight}px`">
        <!--<v-skeleton-loader v-if="!mounted" type="list-item@4" />-->
        <loading-icon v-if="!mounted" />
        <v-window v-show="!!mounted" v-model="tab">
          <v-window-item :value="0">
            <v-expansion-panels
              v-model="panel"
              multiple
              variant="accordion"
              :readonly="tab !== 0"
            >
              <v-expansion-panel :title="$t('optionsApp')" value="app">
                <v-expansion-panel-text>
                  <settings-app
                    :prefs="prefs"
                    @valid="setValid('app', $event)"
                    @refresh="refreshPrefs('app', $event)"
                  />
                </v-expansion-panel-text>
              </v-expansion-panel>
              <v-expansion-panel :title="$t('optionsCongSync')" value="cong">
                <v-expansion-panel-text>
                  <settings-cong
                    :prefs="prefs"
                    @valid="setValid('cong', $event)"
                    @refresh="refreshPrefs('cong', $event)"
                  />
                </v-expansion-panel-text>
              </v-expansion-panel>
              <v-expansion-panel :title="$t('optionsMedia')" value="media">
                <v-expansion-panel-text>
                  <settings-media
                    :prefs="prefs"
                    @valid="setValid('media', $event)"
                    @refresh="refreshPrefs('media', $event)"
                  />
                </v-expansion-panel-text>
              </v-expansion-panel>
              <v-expansion-panel :title="$t('optionsMeetings')" value="meeting">
                <v-expansion-panel-text>
                  <settings-meeting
                    :cache="cache"
                    :prefs="prefs"
                    @valid="setValid('meeting', $event)"
                    @refresh="refreshPrefs('meeting', $event)"
                    @cache="calcCache()"
                  />
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-window-item>
          <v-window-item :value="1">
            <v-container>
              <settings-app
                :prefs="prefs"
                @valid="setValid('app', $event)"
                @refresh="refreshPrefs('app', $event)"
              />
            </v-container>
          </v-window-item>
          <v-window-item :value="2">
            <v-container>
              <settings-cong
                :prefs="prefs"
                @valid="setValid('cong', $event)"
                @refresh="refreshPrefs('cong', $event)"
              />
            </v-container>
          </v-window-item>
          <v-window-item :value="3">
            <v-container>
              <settings-media
                :prefs="prefs"
                @valid="setValid('media', $event)"
                @refresh="refreshPrefs('media', $event)"
              />
            </v-container>
          </v-window-item>
          <v-window-item :value="4">
            <v-container>
              <settings-meeting
                :cache="cache"
                :prefs="prefs"
                @valid="setValid('meeting', $event)"
                @refresh="refreshPrefs('meeting', $event)"
                @cache="calcCache()"
              />
            </v-container>
          </v-window-item>
        </v-window>
      </v-col>
    </v-row>
    <settings-footer
      :prefs="prefs"
      :mounting="!mounted"
      :valid="valid"
      :cache="cache"
      :refresh="refresh"
      @cache="cache = $event"
    />
  </div>
</template>
<script setup lang="ts">
import type { PrefStore } from '~~/types'

useHead({ title: 'Settings' })
const { totalProgress, setProgress, relativeDownloadProgress } = useProgress()
provide(setProgressKey, setProgress)

// Height
const windowSize = inject(windowSizeKey, { width: ref(0), height: ref(0) })
const contentHeight = computed(() => {
  const TOOLBAR_HEIGHT = 112
  const FOOTER_HEIGHT = 76
  return windowSize.height.value - TOOLBAR_HEIGHT - FOOTER_HEIGHT
})

// Control cache
const cache = ref(0)
const refresh = ref(false)
const calcCache = () => (refresh.value = !refresh.value)

// Headers
const { t } = useI18n()
const panel = ref(['app', 'cong', 'media', 'meeting'])
const headers = ref<
  { key: keyof PrefStore; icon: string; name: string; valid: boolean }[]
>([
  {
    key: 'app',
    icon: 'i-mdi:application',
    name: t('optionsApp'),
    valid: false,
  },
  {
    key: 'cong',
    icon: 'i-mdi:cloud',
    name: t('optionsCongSync'),
    valid: false,
  },
  {
    key: 'media',
    icon: 'i-mdi:multimedia',
    name: t('optionsMedia'),
    valid: false,
  },
  {
    key: 'meeting',
    icon: 'i-mdi:lectern',
    name: t('optionsMeetings'),
    valid: false,
  },
])
const mounted = ref(true) // on a new install, without this i couldn't get past the loading spinner
const headersChanged = ref(0)
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
    headersChanged.value++
    mounted.value ||= valid.value || headersChanged.value > 4
  },
  { deep: true },
)

// Prefs
const prefs = ref<PrefStore>({ ...PREFS })
watch(prefs, () => calcCache(), { deep: true })
const refreshPrefs = (key: keyof PrefStore, val: any) => {
  prefs.value[key] = val
}

// Validation
useStatStore().setNavDisabled(true)
const valid = computed(() => headers.value.every((h) => h.valid))
watch(valid, (val) => {
  if (val) calcCache()
  useStatStore().setNavDisabled(!val)
  if (prefs.value.media.enableMediaDisplayButton) {
    const key = prefs.value.media.presentShortcut
    if (val && key) {
      setShortcut({ key, fn: 'openPresentMode' })
    } else {
      unsetShortcut('openPresentMode')
    }
  }
})

const setValid = (key: string, valid: boolean) => {
  const match = headers.value.find((h) => h.key === key)
  if (match) match.valid = valid
}

// Header tabs
const tab = ref(0)
const getInitials = (word: string) => {
  return word
    .split(' ')
    .map((w) => w[0])
    .join('')
}
</script>
<style lang="scss" scoped>
.settings {
  width: 100%;
}
</style>
