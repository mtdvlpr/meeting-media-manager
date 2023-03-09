/* eslint-disable camelcase */
import { event_user_added, event_user_updated } from '@zoomus/websdk/embedded'
import { ZoomPrefs } from '~~/types'

export const zoomSocket = () => window.sockets[window.sockets.length - 1]

export async function connectZoom() {
  const store = useZoomStore()
  const { enable, id, password, name } = getPrefs<ZoomPrefs>('app.zoom>')

  if (!store.client || !enable || !id || !password || !name) {
    if (store.client) {
      store.client.off('user-updated', setUserProps)
      store.client.off('user-added', onUserAdded)
    }
    store.clear()
    return
  }

  notify('remindNeedCoHost')
  const { zoomSdkKey, zoomSignatureEndpoint } = useRuntimeConfig().public

  try {
    await store.client
      .join({
        sdkKey: zoomSdkKey,
        meetingNumber: id,
        password,
        userName: name,
        error: () => {
          log.debug('Caught join error')
        },
        signature: (
          await $fetch<{ signature: string }>(zoomSignatureEndpoint, {
            method: 'POST',
            body: {
              meetingNumber: id,
              role: 0,
            },
          })
        ).signature,
      })
      .catch(() => {
        log.debug('Caught join promise error')
      })
    store.client.on('user-updated', setUserProps)
    store.client.on('user-added', onUserAdded)
    store.setConnected(true)
    setUserProps({ userId: 0, bCoHost: false })
  } catch (e: unknown) {
    log.debug('caught Zoom error')
  }
}

const onUserAdded: typeof event_user_added = (payload) => {
  const store = useZoomStore()
  if (store.client) {
    setUserProps(payload)
  }

  log.debug('User added', payload)

  // @ts-ignore
  const users = payload as (typeof payload)[]
  users
    .filter((user) => !user.bHold)
    .forEach((user) => {
      const renameList = getPrefs<string[]>('app.zoom.autoRename')
      const names = renameList.map((name) => {
        const [old, new_] = name.split('=')
        return { old: old.trim(), new: new_.trim() }
      })
      const name = names.find(
        (name) =>
          name.old.toLowerCase() === user.displayName?.trim().toLowerCase()
      )
      if (name) {
        renameParticipant(null, name.new, {
          id: user.userId,
          name: name.old,
        })
      }
    })
}

const setUserProps: typeof event_user_updated = () => {
  const store = useZoomStore()
  if (!store.client) return
  const userIsHost = store.client.isHost()
  const participants = store.client.getAttendeeslist()
  if (userIsHost && !!store.hostID) {
    store.client.makeCoHost(store.hostID)
  } else if (!userIsHost) {
    const host = participants.find((user) => user.isHost)
    log.debug('host', host)
    if (host) store.setHostID(host?.userId)
  }
  store.setParticipants(participants)
  const user = store.client.getCurrentUser()
  if (user) store.setUserID(user.userId)
  store.setCoHost(userIsHost || store.client.isCoHost())
}