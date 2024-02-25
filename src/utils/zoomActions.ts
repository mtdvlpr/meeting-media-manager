export async function startMeeting(socket: WebSocket | null) {
  const store = useZoomStore()
  if (!store.coHost || !store.client) {
    warn('errorNotCoHost')
    if (!store.client) return
  } else store.started = true

  const hostID = store.hostID

  toggleAllowUnmute(socket, false)
  await muteAll(socket)
  if (!hostID) return
  toggleVideo(socket, true, hostID)
  await toggleMic(socket, false, hostID)
  if (getPrefs<boolean>('app.zoom.spotlight')) {
    toggleSpotlight(socket, true, hostID)
  }
}

export function stopMeeting(socket: WebSocket | null) {
  const store = useZoomStore()
  if (!store.coHost) {
    warn('errorNotCoHost')
  } else store.started = false

  toggleSpotlight(socket, false)
  toggleAllowUnmute(socket, true)
  if (store.hostID) toggleVideo(socket, false, store.hostID)
}

export function muteParticipants(socket: WebSocket | null) {
  const store = useZoomStore()
  if (!store.coHost) {
    warn('errorNotCoHost')
    return
  }

  if (!store.client) return

  const openParticipants = store.client
    .getAttendeeslist()
    .filter(
      (p) =>
        !p.isHost &&
        !p.isCoHost &&
        !p.muted &&
        !store.spotlights.includes(p.userId),
    )
  openParticipants.forEach((p) => {
    toggleMic(socket, true, p.userId)
    lowerHand(socket, p.userId)
  })
}

function lowerHand(socket: WebSocket | null, userID: number) {
  sendToWebSocket(
    socket,
    {
      evt: 4131,
      body: { bOn: false },
    },
    true,
    userID,
  )
}

export async function toggleOnHold(
  socket: WebSocket | null,
  onHold: boolean,
  userID: number,
) {
  const store = useZoomStore()
  if (!store.client) return
  try {
    if (onHold) {
      await store.client.putOnHold(userID, onHold)
    } else {
      await store.client.admit(userID)
    }
  } catch (e: unknown) {
    sendToWebSocket(
      socket,
      {
        evt: 4113,
        body: { bHold: onHold },
      },
      true,
      userID,
    )
  }
}

function toggleAllowUnmute(socket: WebSocket | null, allow: boolean) {
  sendToWebSocket(socket, {
    evt: 4149,
    body: { bOn: allow },
  })
}

function encodeName(name?: string) {
  if (!name) return ''
  try {
    return Buffer.from(name).toString('base64')
  } catch (e: unknown) {
    log.warn('Failed to encode name:', name)
  }
}

export async function renameParticipant(
  socket: WebSocket | null,
  name: string,
  user: { id: number; name?: string },
) {
  const store = useZoomStore()
  if (!store.client) return
  try {
    await store.client.rename(name, user.id)
  } catch (e: unknown) {
    sendToWebSocket(socket, {
      evt: 4109,
      body: {
        id: user.id,
        dn2: encodeName(name),
        olddn2: encodeName(user.name),
      },
    })
  }
}

async function muteAll(socket: WebSocket | null) {
  const store = useZoomStore()
  if (!store.client) return
  try {
    await store.client.muteAll(true)
  } catch (e: unknown) {
    sendToWebSocket(socket, {
      evt: 8201,
      body: { bMute: true },
    })
  }
}

export async function toggleMic(
  socket: WebSocket | null,
  mute: boolean,
  userID?: number,
) {
  const store = useZoomStore()
  if (!store.client) return
  try {
    await store.client.mute(mute, userID)
  } catch (e: unknown) {
    sendToWebSocket(
      socket,
      {
        evt: 8193,
        body: { bMute: mute },
      },
      true,
      userID,
    )
  }
}

function toggleVideo(
  socket: WebSocket | null,
  enable: boolean,
  userID: number,
) {
  sendToWebSocket(
    socket,
    {
      evt: 12297,
      body: { bOn: !enable },
    },
    true,
    userID,
  )
}

export function toggleSpotlight(
  socket: WebSocket | null,
  enable: boolean,
  userID?: number,
) {
  if (enable) {
    sendToWebSocket(
      socket,
      {
        evt: 4219,
        body: { bReplace: false, bSpotlight: true },
      },
      true,
      userID,
    )
  } else {
    sendToWebSocket(socket, {
      evt: 4219,
      body: { bUnSpotlightAll: true },
    })
  }
}

function sendToWebSocket(
  socket: WebSocket | null,
  msg: { evt: number; body: Record<string, any>; seq?: number },
  withUser = false,
  userID?: number,
) {
  const store = useZoomStore()
  let webSocket = store.websocket
  if (!webSocket) {
    if (socket) {
      webSocket = socket
    } else {
      warn('errorNoSocket')
      return
    }
  }
  if (socket) store.websocket = socket
  if (store.client) {
    msg.seq = store.sequence
    if (withUser) {
      msg.body.id = userID ?? store.client.getCurrentUser()?.userId
    }
    webSocket.send(JSON.stringify(msg))
    store.increaseSequence()
  }
}
