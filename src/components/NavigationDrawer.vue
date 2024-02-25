<template>
  <v-navigation-drawer color="secondary" rail expand-on-hover permanent>
    <v-list>
      <v-list-item title="M³">
        <template #subtitle>
          <v-btn
            v-if="getPrefs('app.congregationName')"
            :to="localePath('/')"
            size="x-small"
            variant="tonal"
            :disabled="!!musicFadeOut || navDisabled"
          >
            {{ getPrefs('app.congregationName') }}
          </v-btn>
        </template>
        <template #prepend>
          <v-avatar rounded="0" image="~/assets/img/icon.png" />
        </template>
      </v-list-item>
    </v-list>
    <v-divider />
    <v-list nav>
      <v-list-item
        v-for="item in navItems"
        :key="item.title"
        :to="item.to"
        :title="item.title"
        :disabled="navDisabled"
        :aria-label="item.aria"
        :prepend-icon="item.icon"
      >
        <v-tooltip v-if="item.tooltip" activator="parent">
          {{ item.tooltip }}
        </v-tooltip>
      </v-list-item>
    </v-list>

    <template #append>
      <v-list nav>
        <v-list-item
          v-if="!online"
          prepend-icon="i-mdi:wifi-off"
          title="No internet connection"
        >
        </v-list-item>
        <v-list-item
          v-if="showMusicButton"
          :title="$t('shuffleMusic')"
          :disabled="musicLoading"
          @click="toggleMusic()"
        >
          <template #prepend>
            <v-progress-circular
              v-if="musicLoading"
              indeterminate
              size="small"
              class="mr-8"
            />
            <v-icon v-else-if="musicFadeOut" icon="i-mdi:stop-circle-outline" />
            <v-icon v-else icon="i-mdi:music-note" />
          </template>
          <template v-if="musicFadeOut" #append>
            <v-chip variant="plain" density="compact">
              {{ timeRemaining }}
            </v-chip>
          </template>
          <v-tooltip activator="parent">
            {{ getPrefs('meeting.shuffleShortcut') }}
          </v-tooltip>
        </v-list-item>
        <v-list-item
          v-if="showMediaPlayback"
          :class="{ 'pulse-danger': !mediaVisible }"
          :prepend-icon="mediaVisible ? 'i-mdi:tv' : 'i-mdi:tv-off'"
          :title="$t(`mediaWin${mediaVisible ? 'Hide' : 'Show'}`)"
          @click="toggleScreen()"
        >
          <v-tooltip activator="parent">
            {{ getPrefs('media.mediaWinShortcut') }}
          </v-tooltip>
        </v-list-item>
      </v-list>
    </template>
  </v-navigation-drawer>
</template>
<script setup lang="ts">
import { useIpcRenderer } from '@vueuse/electron'
const { t } = useI18n()
const localePath = useLocalePath()
const { navDisabled, showMediaPlayback, showMusicButton, online } =
  storeToRefs(useStatStore())

const navItems = computed(() => {
  const items = [
    {
      title: t('plannedMedia'),
      icon: 'i-mdi:calendar-week',
      to: localePath('/home'),
      tooltip: '',
      aria: 'home',
    },
    {
      title: t('settings'),
      icon: 'i-mdi:cog',
      to: localePath('/settings'),
      tooltip: '',
      aria: 'settings',
    },
  ]
  if (showMediaPlayback.value) {
    items.unshift({
      title: t('mediaPlayback'),
      icon: 'i-mdi:multimedia',
      to: localePath('/present'),
      tooltip: getPrefs<string>('media.presentShortcut'),
      aria: 'present',
    })
  }
  return items
})

// Background music
let timeRemaining = ref('')
const musicLoading = ref(false)
const { musicFadeOut } = storeToRefs(useMediaStore())
const toggleMusic = async () => {
  musicLoading.value = true
  await shuffleMusic(!!musicFadeOut.value)
  musicLoading.value = false
}

watch(
  musicFadeOut,
  (val) => {
    if (!val) return
    if (typeof val === 'string') {
      timeRemaining.value = val
    } else {
      const { formatted } = useTimeRemaining(val, async () => {
        musicLoading.value = false
        await shuffleMusic(true)
        musicLoading.value = false
      })
      timeRemaining = formatted
    }
  },
  { immediate: true },
)

// Media Window
const presentStore = usePresentStore()
const { mediaScreenVisible: mediaVisible } = storeToRefs(presentStore)
const toggleScreen = () => {
  useIpcRenderer().send('toggleMediaWindowFocus')
}
</script>
