<template>
  <div style="width: 100%">
    <v-dialog
      :model-value="!!participant"
      max-width="700px"
      @click:outside="participant = null"
    >
      <v-card>
        <v-row no-gutters class="pa-2">
          <v-col cols="12">
            <v-text-field v-model="newName" clearable />
          </v-col>
          <v-col>
            <v-checkbox v-model="saveRename" :label="$t('zoomSaveRename')" />
          </v-col>
          <v-col cols="auto" class="d-flex align-center">
            <v-btn color="error" @click="participant = null">
              {{ $t('cancel') }}
            </v-btn>
            <v-btn
              color="primary"
              class="ml-2"
              :loading="renaming"
              aria-label="save"
              @click="renamePerson(participant, newName)"
            >
              <v-icon icon="i-mdi:check-bold" />
            </v-btn>
          </v-col>
        </v-row>
      </v-card>
    </v-dialog>
    <v-toolbar id="zoom-app-bar" theme="dark" color="primary" density="compact">
      <v-app-bar-nav-icon icon="i-mdi:alpha-z-box" />
      <v-btn
        icon
        aria-label="Toggle zoom component"
        @click="showZoomComponent = !showZoomComponent"
      >
        <v-tooltip activator="parent" location="bottom">
          {{ $t('zoomToggleComponent') }}
        </v-tooltip>
        <v-icon
          :icon="`i-mdi:eye${showZoomComponent ? '' : '-off'}`"
          size="small"
        />
      </v-btn>
      <v-btn
        icon
        :loading="loadingZoom"
        aria-label="Toggle zoom meeting"
        @click="toggleZoomMeeting()"
      >
        <v-tooltip activator="parent" location="bottom">
          {{ $t(`zoom${started ? 'Stop' : 'Start'}Meeting`) }}
        </v-tooltip>
        <v-icon :icon="started ? 'i-mdi:stop' : 'i-mdi:play'" />
      </v-btn>
      <v-btn
        icon
        aria-label="Mute Zoom participants"
        @click="muteParticipants(zoomSocket())"
      >
        <v-tooltip activator="parent" location="bottom">
          {{ $t('zoomMuteParticipants') }}
        </v-tooltip>
        <v-icon icon="i-mdi:microphone-off" size="small" />
      </v-btn>
      <v-spacer />
      <v-autocomplete
        v-model="participants"
        v-model:search-input="participantSearch"
        color="white"
        item-title="userName"
        item-value="userId"
        :loading="allParticipants.length == 0"
        :label="$t('spotlightParticipants')"
        :disabled="spotlightActive"
        :items="allParticipants"
        style="max-width: 500px"
        hide-details="auto"
        chips
        closable-chips
        multiple
        clearable
        return-object
        @update:model-value="participantSearch = ''"
      >
        <template #item="{ item }">
          <v-list-item-action>
            <v-checkbox-btn
              :value="participants.includes(item.raw)"
              @click="toggleParticipant(item.raw)"
            />
          </v-list-item-action>
          <v-list-item-title>{{ item.raw.userName }}</v-list-item-title>
          <v-list-item-action>
            <v-btn icon @click.stop="atRename(item.raw)">
              <v-icon icon="i-mdi:pencil" size="small" />
            </v-btn>
          </v-list-item-action>
        </template>
      </v-autocomplete>
      <v-btn
        :icon="spotlightActive ? 'i-mdi:account-minus' : 'i-mdi:account-box'"
        size="small"
        :class="{ 'pulse-danger': spotlightActive }"
        :disabled="participants.length == 0"
        @click="spotlightParticipants()"
      />
    </v-toolbar>
  </div>
</template>
<script setup lang="ts">
import { useIpcRenderer } from '@vueuse/electron'
import type { Participant } from '@zoom/meetingsdk/embedded'

const store = useZoomStore()
const { started, coHost, hostID } = storeToRefs(store)

onMounted(() => {
  setTimeout(() => {
    const el = document.querySelector<HTMLButtonElement>(
      '#zoom-app-bar button.v-app-bar__nav-icon',
    )

    if (el) el.disabled = true
  }, MS_IN_SEC)
})

// Participant selector
const participantSearch = ref('')
const participants = ref<Participant[]>([])
const allParticipants = computed(() => {
  return store.participants.filter(
    (p) => !p.isHold && p.userName !== getPrefs<string>('app.zoom.name'),
  )
})
const toggleParticipant = (participant: Participant) => {
  if (participants.value.includes(participant)) {
    participants.value = participants.value.filter(
      (p) => p.userId !== participant.userId,
    )
  } else {
    participants.value.push(participant)
  }
}

// Zoom component
const showZoomComponent = ref(false)
watch(showZoomComponent, (show: boolean) => {
  const el = document.getElementById('zoomMeetingContainer')
  if (!el) return
  el.style.display = show ? 'flex' : 'none'
})

// Rename participant
const newName = ref('')
const renaming = ref(false)
const saveRename = ref(true)
const participant = ref<Participant | null>(null)
const atRename = (p: Participant) => {
  participant.value = p
  newName.value = p.userName
  saveRename.value = true
}
const renamePerson = async (p: Participant | null, name = '') => {
  if (!p) return
  renaming.value = true
  await renameParticipant(zoomSocket(), name, {
    id: p.userId,
    name: p.userName,
  })
  if (saveRename.value) {
    const renames = getPrefs<string[]>('app.zoom.autoRename')
    if (!renames.find((r) => r.split('=')[0] === p.userName)) {
      renames.push(`${p.userName}=${name}`)
      setPrefs('app.zoom.autoRename', renames)
    }
  }
  participant.value = null
  renaming.value = false
}

// Toggle meeting
const loadingZoom = ref(false)
const toggleZoomMeeting = async () => {
  loadingZoom.value = true
  if (started.value) {
    stopMeeting(zoomSocket())
  } else {
    await startMeeting(zoomSocket())
  }
  loadingZoom.value = false
}

// Spotlight
const spotlightActive = ref(false)
const spotlightParticipants = () => {
  if (!coHost.value) {
    warn('errorNotCoHost')
    return
  }
  toggleSpotlight(zoomSocket(), false)
  if (spotlightActive.value) {
    muteParticipants(zoomSocket())
    if (hostID.value && getPrefs<boolean>('app.zoom.spotlight')) {
      toggleSpotlight(zoomSocket(), true, hostID.value)
    }
    participants.value = []
    store.spotlights = []
  } else {
    store.spotlights = participants.value.map((p) => p.userId)
    for (const p of participants.value) {
      toggleSpotlight(zoomSocket(), true, p.userId)
      toggleMic(zoomSocket(), false, p.userId)
    }

    if (usePresentStore().mediaScreenVisible !== spotlightActive.value) {
      useIpcRenderer().send('toggleMediaWindowFocus')
    }
    spotlightActive.value = !spotlightActive.value
  }
}
</script>
<style scoped lang="scss">
#zoom-app-bar {
  button.v-app-bar-nav-icon {
    cursor: initial !important;

    :deep(.v-btn__overlay) {
      opacity: 0 !important;
    }
  }
}
</style>
