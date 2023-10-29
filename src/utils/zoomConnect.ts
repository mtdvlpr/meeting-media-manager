import type { ParticipantPropertiesPayload } from '@zoomus/websdk/embedded'
import type { ZoomPrefs } from '~~/types'

export const zoomSocket = () => {
  if (!window.sockets || window.sockets.length === 0) return null
  return window.sockets[window.sockets.length - 1]
}

export async function connectZoom() {
  const store = useZoomStore()
  const { enable, id, password, name } = getPrefs<ZoomPrefs>('app.zoom')

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
  if (!zoomSdkKey) {
    log.warn('No zoom SDK key found!')
  }

  if (!zoomSignatureEndpoint) {
    log.warn('No zoom Signature Endpoint found!')
  }

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
    setUserProps()
  } catch (e: unknown) {
    log.debug('caught Zoom error')
  }
}

const onUserAdded = (payload: ParticipantPropertiesPayload) => {
  const store = useZoomStore()
  if (store.client) {
    setUserProps()
  }

  log.debug('User added', payload)

  const users = payload as unknown as ParticipantPropertiesPayload[]
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
          name.old.toLowerCase() === user.displayName?.trim().toLowerCase(),
      )
      if (name) {
        renameParticipant(null, name.new, {
          id: user.userId,
          name: name.old,
        })
      }
    })
}

const setUserProps = () => {
  const store = useZoomStore()
  if (!store.client) return
  const userIsHost = store.client.isHost()
  const participants = store.client.getAttendeeslist()
  if (userIsHost && !!store.hostID) {
    store.client.makeCoHost(store.hostID)
  } else if (!userIsHost) {
    const host = participants.find((user) => user.isHost)
    log.debug('host', host)
    if (host) store.setHostID(host.userId)
  }
  store.setParticipants(participants)
  const user = store.client.getCurrentUser()
  if (user) store.setUserID(user.userId)
  store.setCoHost(userIsHost || store.client.isCoHost())
}
