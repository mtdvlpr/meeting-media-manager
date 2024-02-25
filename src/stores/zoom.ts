import type { EmbeddedClient, Participant } from '@zoom/meetingsdk/embedded'

interface ZoomStore {
  client: typeof EmbeddedClient | null
  participants: Participant[]
  connected: boolean
  coHost: boolean
  sequence: number
  started: boolean
  websocket: WebSocket | null
  userID: number | null
  hostID: number | null
  spotlights: number[]
}

export const useZoomStore = defineStore('zoom', {
  state: (): ZoomStore => ({
    client: null,
    participants: [],
    connected: false,
    coHost: false,
    sequence: 1,
    started: false,
    websocket: null,
    userID: null,
    hostID: null,
    spotlights: [],
  }),
  actions: {
    increaseSequence() {
      this.sequence++
    },
    async clear() {
      if (this.client) {
        const { default: zoomSDK } = await import('@zoom/meetingsdk/embedded')
        zoomSDK.destroyClient()
      }
      this.$reset()
    },
  },
})
