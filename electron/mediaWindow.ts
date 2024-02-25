import { platform } from 'os'
import { join } from 'path'
import {
  BrowserWindow,
  type BrowserWindowConstructorOptions,
  ipcMain,
  type Point,
} from 'electron'
import { AR_HEIGHT, AR_WIDTH } from './main'
import BrowserWinHandler from './BrowserWinHandler'
import { getMainWindow, getMainWinHandler } from './mainWindow'
import { getScreenInfo } from './utils'
import {
  getWebsiteController,
  getWebsiteControllerWinHandler,
} from './websiteController'
import type { PrefStore } from '~~/types'

const isDev = process.env.NODE_ENV === 'development'

let mediaWin: BrowserWindow | null
let mediaWinHandler: BrowserWinHandler | null
let authorizedCloseMediaWin = false

export function initMediaWinListeners() {
  ipcMain.removeAllListeners('showMediaWindow')
  ipcMain.on(
    'showMediaWindow',
    (
      _e,
      mediaWinOptions: { destination: number; type: 'fullscreen' | 'window' },
    ) => {
      initMediaWindow(mediaWinOptions)
    },
  )

  ipcMain.removeAllListeners('showMedia')
  ipcMain.on(
    'showMedia',
    (
      _e,
      media: {
        src: string
        stream?: boolean
        start?: string
        end?: string
      } | null,
    ) => {
      mediaWin?.webContents.send('showMedia', media)
      getMainWindow().webContents.send('showingMedia', [
        !!media,
        !!media?.start && !media?.end?.startsWith('00:00:00'),
      ])
    },
  )

  ipcMain.removeAllListeners('closeMediaWindow')
  ipcMain.on('closeMediaWindow', () => {
    closeMediaWindow()
  })

  ipcMain.removeAllListeners('toggleMediaWindowFocus')
  ipcMain.on('toggleMediaWindowFocus', () => {
    fadeWindow()
  })

  ipcMain.removeAllListeners('hideMedia')
  ipcMain.on('hideMedia', () => {
    mediaWin?.webContents.send('hideMedia')
    getMainWindow().webContents.send('showingMedia', false)
  })

  ipcMain.removeAllListeners('pauseVideo')
  ipcMain.on('pauseVideo', () => {
    mediaWin?.webContents.send('pauseVideo')
  })

  ipcMain.removeAllListeners('playVideo')
  ipcMain.on('playVideo', () => {
    mediaWin?.webContents.send('playVideo')
  })

  ipcMain.removeAllListeners('moveMouse')
  ipcMain.on('moveMouse', (_e, pos: Point) => {
    mediaWin?.webContents.send('moveMouse', pos)
  })

  ipcMain.removeAllListeners('toggleSubtitles')
  ipcMain.on(
    'toggleSubtitles',
    (_e, payload: { enabled: boolean; toggle: boolean }) => {
      mediaWin?.webContents.send('toggleSubtitles', payload)
    },
  )

  ipcMain.removeAllListeners('scrubVideo')
  ipcMain.on('scrubVideo', (_e, timeAsPercent: number) => {
    mediaWin?.webContents.send('scrubVideo', timeAsPercent)
  })

  ipcMain.removeAllListeners('startMediaDisplay')
  ipcMain.on('startMediaDisplay', (_e, prefs: PrefStore) => {
    mediaWin?.webContents.send('startMediaDisplay', prefs)
  })

  ipcMain.removeAllListeners('zoom')
  ipcMain.on('zoom', (_e, scale: number) => {
    mediaWin?.webContents.send('zoom', scale)
  })

  ipcMain.removeAllListeners('pan')
  ipcMain.on('pan', (_e, coords: Point) => {
    mediaWin?.webContents.send('pan', coords)
  })

  ipcMain.removeHandler('mediaWinOpen')
  ipcMain.handle('mediaWinOpen', () => !!mediaWin)

  ipcMain.removeHandler('mediaWinVisible')
  ipcMain.handle('mediaWinVisible', () => mediaWin && mediaWin.isVisible())
}

async function initMediaWindow(mediaWinOptions: {
  destination: number
  type: 'fullscreen' | 'window'
}) {
  const winHandler = getMainWinHandler()
  if (
    mediaWin &&
    platform() === 'darwin' &&
    (mediaWinOptions.type === 'window') === mediaWin.isFullScreen()
  ) {
    closeMediaWindow()
  }

  if (mediaWin) {
    setMediaWindowPosition(winHandler, mediaWinOptions)
  } else {
    const screenInfo = getScreenInfo()
    const STARTING_POSITION = 50

    // Set correct app icon
    let iconType = 'png'
    if (platform() === 'darwin') iconType = 'icns'
    if (platform() === 'win32') iconType = 'ico'

    const windowOptions: BrowserWindowConstructorOptions = {
      icon: join(process.resourcesPath, 'icons', `videoPlayer.${iconType}`),
      fullscreen: mediaWinOptions.type === 'fullscreen',
      x:
        (screenInfo.displays.find(
          (display) => display.id === mediaWinOptions.destination,
        )?.bounds.x ?? 0) + STARTING_POSITION,
      y:
        (screenInfo.displays.find(
          (display) => display.id === mediaWinOptions.destination,
        )?.bounds.y ?? 0) + STARTING_POSITION,
    }

    mediaWinHandler = createMediaWindow(windowOptions)
    mediaWin = await mediaWinHandler.created()

    mediaWin
      .on('close', (e) => {
        if (authorizedCloseMediaWin || isDev) {
          mediaWin = null
          mediaWinHandler = null
        } else {
          e.preventDefault()
        }
      })
      .on('will-resize', () => {
        // Not working on Linux
        mediaWin?.webContents.send('windowResizing', mediaWin.getSize())
        winHandler.send('resetZoom')
        mediaWin?.webContents.send('resetZoom')
      })
      .on('resize', () => {
        const websiteController = getWebsiteController()
        const websiteControllerHandler = getWebsiteControllerWinHandler()
        if (websiteControllerHandler) {
          websiteControllerHandler.send('mediaSize', mediaWin?.getContentSize())
          websiteControllerHandler.send(
            'winSize',
            websiteController?.getContentSize(),
          )
        }
        if (platform() === 'linux') {
          winHandler.send('resetZoom')
          mediaWin?.webContents.send('resetZoom')
        }
      })
      // Not available for Linux
      .on('resized', () => {
        mediaWin?.webContents.send('windowResized')
      })

    winHandler.send('mediaWindowShown')
  }
}

function createMediaWindow(windowOpts: BrowserWindowConstructorOptions) {
  const winHandler = new BrowserWinHandler({
    title: 'Media Window',
    roundedCorners: windowOpts.fullscreen,
    backgroundColor: 'black',
    width: 1280,
    height: 720,
    minHeight: 110,
    minWidth: 195,
    frame: false,
    thickFrame: false,
    show: false,
    ...windowOpts,
  })

  const win = winHandler.browserWindow!
  win.setAspectRatio(AR_WIDTH / AR_HEIGHT)
  if (platform() !== 'darwin') {
    win.setAlwaysOnTop(true, 'screen-saver')
    win.setMenuBarVisibility(false)
  }

  winHandler.loadPage('/media')

  win.once('ready-to-show', () => {
    win.show()
  })

  return winHandler
}

export function fadeWindow() {
  const winHandler = getMainWinHandler()
  if (!mediaWin) return
  if (!mediaWin.isVisible()) {
    mediaWin.show()
    winHandler.send('mediaWindowVisibilityChanged', 'shown')
  } else {
    mediaWin.hide()
    winHandler.send('mediaWindowVisibilityChanged', 'hidden')
  }
}

function setMediaWindowPosition(
  winHandler: BrowserWinHandler,
  mediaWinOptions: {
    destination: number
    type: 'window' | 'fullscreen'
  },
) {
  try {
    if (mediaWin) {
      const screenInfo = getScreenInfo()
      const STARTING_POSITION = 50
      mediaWin.setBounds({
        x:
          (screenInfo.displays.find(
            (display) => display.id === mediaWinOptions.destination,
          )?.bounds.x ?? 0) + STARTING_POSITION,
        y:
          (screenInfo.displays.find(
            (display) => display.id === mediaWinOptions.destination,
          )?.bounds.y ?? 0) + STARTING_POSITION,
        ...(mediaWinOptions.type === 'window' && { width: 1280 }),
        ...(mediaWinOptions.type === 'window' && { height: 720 }),
      })
      if (
        mediaWinOptions.type === 'fullscreen' &&
        screenInfo.otherScreens.length > 0 &&
        !mediaWin.isFullScreen()
      ) {
        mediaWin.setFullScreen(true)
      } else if (mediaWinOptions.type === 'window' && mediaWin.isFullScreen()) {
        mediaWin.setFullScreen(false)
      }
    }
  } catch (err) {
    winHandler.send('notifyUser', ['errorUnknown', { type: 'error' }, err])
  }
}

export function getMediaWin() {
  return mediaWin
}

export function getMediaWinHandler() {
  return mediaWinHandler
}

function closeMediaWindow() {
  if (mediaWin) {
    authorizedCloseMediaWin = true
    mediaWin.close()
    mediaWin = null
    mediaWinHandler = null
    authorizedCloseMediaWin = false
  }
}
