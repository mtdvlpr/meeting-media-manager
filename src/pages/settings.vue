<template>
  <v-container class="settings">
    <v-row justify="center">
      <v-col cols="12">
        <v-skeleton-loader v-if="!mounted" type="list-item@4" />
        <v-window v-show="mounted" v-model="tab">
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
            <v-sheet>
              <v-container>
                <settings-app
                  :prefs="prefs"
                  @valid="setValid('app', $event)"
                  @refresh="refreshPrefs('app', $event)"
                />
              </v-container>
            </v-sheet>
          </v-window-item>
          <v-window-item :value="2">
            <v-sheet>
              <v-container>
                <settings-cong
                  :prefs="prefs"
                  @valid="setValid('cong', $event)"
                  @refresh="refreshPrefs('cong', $event)"
                />
              </v-container>
            </v-sheet>
          </v-window-item>
          <v-window-item :value="3">
            <v-sheet>
              <v-container>
                <settings-media
                  :prefs="prefs"
                  @valid="setValid('media', $event)"
                  @refresh="refreshPrefs('media', $event)"
                />
              </v-container>
            </v-sheet>
          </v-window-item>
          <v-window-item :value="4">
            <v-sheet>
              <v-container>
                <settings-meeting
                  :cache="cache"
                  :prefs="prefs"
                  @valid="setValid('meeting', $event)"
                  @refresh="refreshPrefs('meeting', $event)"
                  @cache="calcCache()"
                />
              </v-container>
            </v-sheet>
          </v-window-item>
        </v-window>
      </v-col>
    </v-row>
  </v-container>
</template>
<script setup lang="ts">
import type { PrefStore } from '~~/types'

useHead({ title: 'Settings' })
definePageMeta({ layout: 'settings' })

const tab = inject(settingsTabKey, ref(0))
const headers = inject(settingsHeadersKey, ref([]))
const panel = inject(settingsPanelKey, ref([]))
const valid = inject(settingsValidKey, ref(false))
const mounted = inject(settingsMountedKey, ref(false))

// Cache
const cache = inject(settingsCacheKey, ref(0))
const calcCache = inject(settingsCalcCacheKey, () => {})

// Prefs
const prefs = inject(settingsPrefsKey, ref<PrefStore>({ ...DEFAULT_PREFS }))
const refreshPrefs = (key: keyof PrefStore, val: any) => {
  prefs.value[key] = val
}

// Validation
useStatStore().navDisabled = true
watch(valid, (val) => {
  if (val) calcCache()
  useStatStore().navDisabled = !val
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
</script>
<style lang="scss" scoped>
.settings {
  width: 100%;
}
</style>
