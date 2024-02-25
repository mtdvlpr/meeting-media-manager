<template>
  <div class="present-page">
    <v-app-bar v-if="!date">
      <v-app-bar-title>{{ $t('selectDate') }}</v-app-bar-title>
    </v-app-bar>
    <confirm-dialog
      v-model="dialog"
      description="obsZoomSceneActivate"
      @cancel="dialog = false"
      @confirm="confirmZoomPart()"
    >
      <v-autocomplete
        v-if="!!zoomClient"
        v-model="participant"
        :loading="participants.length === 0"
        :label="$t('unmuteParticipant')"
        :items="participants"
        item-title="userName"
        item-value="userId"
        return-object
      />
    </confirm-dialog>
    <div id="zoomMeetingContainer" style="display: none">
      <div id="zoomMeeting" />
    </div>
    <media-controls v-if="date" />
    <present-select v-else :first-choice="firstChoice" />
    <present-footer
      v-if="date"
      :participant="participant"
      @zoom-part="toggleZoomPart()"
      @clear-participant="participant = null"
    />
  </div>
</template>
<script setup lang="ts">
import { useRouteQuery } from '@vueuse/router'
import { useIpcRenderer, useIpcRendererOn } from '@vueuse/electron'
import type { Participant } from '@zoom/meetingsdk/embedded'
import type { ZoomPrefs } from '~~/types'

const date = useRouteQuery<string>('date', '')
useHead({
  title: computed(() =>
    date.value ? `Present ${date.value}` : 'Presentation Mode',
  ),
})

// General state
const firstChoice = ref(true)
watch(date, (val) => {
  if (val) {
    if (firstChoice.value) {
      initZoomIntegration()
      if (getPrefs<boolean>('media.enablePp')) {
        const ppForward = getPrefs<string>('media.ppForward')
        const ppBackward = getPrefs<string>('media.ppBackward')
        if (ppForward && ppBackward) {
          setShortcut({ key: ppForward, fn: 'nextMediaItem', scope: 'present' })
          setShortcut({
            key: ppBackward,
            fn: 'previousMediaItem',
            scope: 'present',
          })
        } else {
          warn('errorPpEnable')
        }
      }
    }
    firstChoice.value = false
  }
})
const mediaActive = ref(false)
provide(mediaActiveKey, mediaActive)
const videoActive = ref(false)
provide(videoActiveKey, videoActive)
useIpcRendererOn('showingMedia', (_e, val: boolean[]) => {
  mediaActive.value = val[0]
  videoActive.value = val[1]
})

onMounted(() => {
  useIpcRenderer().send('allowQuit', false)
})

// OBS
const dialog = ref(false)
const zoomPart = ref(false)
provide(zoomPartKey, zoomPart)
const confirmZoomPart = () => {
  dialog.value = false
  zoomPart.value = true
}
const toggleZoomPart = () => {
  if (zoomPart.value) {
    zoomPart.value = false
  } else {
    dialog.value = true
  }
}

// Zoom integration
const zoomStore = useZoomStore()
const { localeProperties } = useI18n()
const {
  client: zoomClient,
  coHost,
  started: zoomStarted,
  participants: allParticipants,
} = storeToRefs(zoomStore)
whenever(coHost, () => {
  useNotifyStore().dismissByMessage('remindNeedCoHost')
})
const participant = ref<Participant | null>(null)
const participants = computed(() =>
  allParticipants.value.filter(
    (p) => !p.isHold && p.userName !== getPrefs<string>('app.zoom.name'),
  ),
)
onBeforeUnmount(() => {
  unsetShortcuts('present')
  useIpcRenderer().send('allowQuit', true)
  if (zoomClient.value) {
    stopMeeting(zoomSocket())
    zoomClient.value.leaveMeeting().then(() => {
      zoomStore.clear()
    })
    useNotifyStore().dismissByMessages([
      'remindNeedCoHost',
      'errorNotCoHost',
      'errorNoSocket',
    ])
  }
})
const initZoomIntegration = async () => {
  const { enable, name, id, password } = getPrefs<ZoomPrefs>('app.zoom')
  if (!enable || !name || !id || !password) return

  listenToZoomSocket()
  const { default: zoomSDK } = await import('@zoom/meetingsdk/embedded')
  const client = zoomSDK.createClient()
  zoomStore.client = client
  try {
    await client
      .init({
        debug: true,
        zoomAppRoot: document.getElementById('zoomMeeting') ?? undefined,
        // @ts-expect-error
        language: localeProperties.value.iso,
      })
      .catch(() => {
        log.debug('Caught init promise error')
      })
  } catch (e: unknown) {
    log.debug('Caught init error')
  }

  connectZoom()

  setTimeout(() => {
    const socket = zoomSocket()
    if (socket) {
      log.debug('Found socket')
      zoomStore.websocket = socket
    }
  }, MS_IN_SEC)

  if (getPrefs<boolean>('app.zoom.autoStartMeeting')) {
    executeBeforeMeeting(
      'startZoom',
      getPrefs<number>('app.zoom.autoStartTime'),
      () => {
        if (!zoomStarted.value) startMeeting(zoomSocket())
      },
    )
  }
}
const listenToZoomSocket = () => {
  const originalSend = WebSocket.prototype.send
  window.sockets = []
  WebSocket.prototype.send = function (...args) {
    log.debug('send:', args)
    if (
      this.url.includes('zoom') &&
      this.url.includes('dn2') &&
      !window.sockets?.includes(this)
    ) {
      window.sockets?.push(this)
      log.info('sockets', window.sockets)
    }
    originalSend.call(this, ...args)
  }
}
</script>
<style lang="scss">
.present-page {
  #zoomMeeting {
    width: 0;
    height: 0;

    > div {
      z-index: 1100;
    }
  }
}
</style>
