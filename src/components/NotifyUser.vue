<!-- eslint-disable vue/no-v-html -->
<template>
  <v-snackbar
    v-for="(m, i) in notifications"
    :id="`msg-${m.timestamp}-${m.message}-${m.identifier}`"
    :key="`${m.timestamp}-${m.message}-${m.identifier}`"
    location="top right"
    rounded
    color="bg"
    vertical
    model-value
    min-width="350px"
    width="30%"
    :timeout="m.persistent ? -1 : 10000"
    content-class="message-content"
    :style="`z-index: 9000; top: ${combinedHeight(i)}px`"
    @update:model-value="store.dismiss(i)"
  >
    <v-row justify="space-between">
      <v-col cols="auto" class="d-flex align-center">
        <v-icon :icon="icon(m.type)" :color="iconColor(m.type)" class="mr-1" />
        {{ $t(m.type) }}
      </v-col>
      <v-col cols="auto" class="pa-2">
        <v-btn
          v-if="m.persistent || m.dismiss"
          icon="i-mdi:close"
          size="x-small"
          variant="text"
          class="align-right"
          @click="store.dismiss(i)"
        />
      </v-col>
    </v-row>
    <v-divider class="mt-2" />
    <p class="pa-2" v-html="$t(m.message)" />
    <code v-if="m.identifier">{{ m.identifier }}</code>
    <v-divider v-if="m.action" class="mt-2" />
    <template v-if="m.action" #actions>
      <v-btn
        size="small"
        color="primary"
        variant="elevated"
        @click="executeAction(m.action)"
      >
        {{ $t(m.action!.label) }}
      </v-btn>
    </template>
    <template v-else-if="m.message === 'updateDownloaded'" #actions>
      <v-btn size="small" color="primary" variant="elevated" @click="install">
        {{ $t('installNow') }}
      </v-btn>
    </template>
  </v-snackbar>
</template>
<script setup lang="ts">
import { ipcRenderer } from 'electron'
import type { NotifyAction } from '~~/types'

const store = useNotifyStore()
const { notifications } = storeToRefs(store)

const install = () => {
  ipcRenderer.send('installNow')
}

const icon = (type: string) => {
  switch (type) {
    case 'warning':
    case 'error':
      return 'i-mdi:alert-circle'
    case 'success':
      return 'i-mdi:check-circle'
    default:
      return 'i-mdi:information'
  }
}

const iconColor = (type: string) => {
  switch (type) {
    case 'warning':
    case 'error':
    case 'success':
      return type
    default:
      return 'primary'
  }
}

const executeAction = (action?: NotifyAction) => {
  if (!action) return
  window.open(
    action.type === 'error' ? bugURL(action.error) : action.url,
    '_blank',
  )
}

const combinedHeight = (index: number) => {
  const MARGIN_BETWEEN_MESSAGES = 8
  let height = 8
  for (let i = 0; i < index; i++) {
    height += getHeight(i) // The height of each message
    height += MARGIN_BETWEEN_MESSAGES // The margin between messages
  }
  return height + MARGIN_BETWEEN_MESSAGES // The start margin for the first message
}

const getHeight = (index: number) => {
  const msg = notifications.value[index]
  const el = document.getElementById(
    `msg-${msg.timestamp}-${msg.message}-${msg.identifier}`,
  )
  if (el) {
    return el.children[0].clientHeight
  } else {
    return 0
  }
}
</script>
<style lang="scss">
.message-content {
  width: 100%;
  padding: 4px 6px !important;

  .v-snackbar__content {
    width: 100%;
  }

  code {
    font-size: 0.875em;
    color: #d63384;
    word-wrap: break-word;
  }
}
</style>
