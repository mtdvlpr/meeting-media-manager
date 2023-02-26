import { appLongName } from 'constants/general'
import { BrowserWindow, ipcMain, screen } from 'electron'
import BrowserWinHandler from './BrowserWinHandler'
import { fadeWindow, getMediaWin } from './mediaWindow'
import { getScreenInfo } from './utils'
import { getWebsiteController } from './websiteController'
import windowStateKeeper from 'electron-window-state'

let win: BrowserWindow
let winHandler: BrowserWinHandler
let closeAttempts = 0
let allowClose = true

interface Pos {
  x?: number
  y?: number
  width?: number
  height?: number
  manage?: (win: BrowserWindow) => void
}

function onMove() {
  if (!getMediaWin()) return
  const screenInfo = getScreenInfo()
  if (screenInfo.winMidpoints && screenInfo.otherScreens.length > 0) {
    const mainWinSameAsMedia = Object.entries(screenInfo.winMidpoints)
      .map((item) => screen.getDisplayNearestPoint(item[1]))
      .every((val, _i, arr) => val.id === arr[0].id)

    if (mainWinSameAsMedia) {
      win?.webContents.send('moveMediaWindowToOtherScreen')
    }
  }
}

function onClose(e: Event) {
  const MS_IN_SEC = 1000
  if ((!allowClose || getWebsiteController()) && closeAttempts < 2) {
    e.preventDefault()
    win?.webContents.send('notifyUser', [
      'cantCloseMediaWindowOpen',
      { type: 'warning' },
    ])
    closeAttempts++
    setTimeout(() => {
      closeAttempts--
    }, 10 * MS_IN_SEC)
  } else {
    getWebsiteController()?.destroy()
    getMediaWin()?.destroy()
  }
}

function createMainWindow(
  pos: Pos = { width: 700, height: 700 }
): BrowserWinHandler {
  const winHandler = new BrowserWinHandler({
    x: pos.x,
    y: pos.y,
    height: pos.height,
    width: pos.width,
    minWidth: 670,
    minHeight: 475,
    title: appLongName,
  })

  winHandler.onCreated((win) => {
    if (pos.manage) {
      pos.manage(win)
    }

    win.on('move', onMove)
    win.on('close', onClose)
  })

  winHandler.loadPage('/')
  return winHandler
}

export function sendToMain(channel: string, ...args: any[]) {
  winHandler.send(channel, ...args)
}

export function getMainWindow() {
  return win
}

export function getMainWinHandler() {
  return winHandler
}

export function resetCloseAttempts() {
  closeAttempts = 0
  allowClose = false
}

export async function initMainWindow() {
  winHandler = createMainWindow(
    windowStateKeeper({
      defaultWidth: 700,
      defaultHeight: 700,
    })
  )
  win = await winHandler.created()

  registerListeners()

  return winHandler
}

function registerListeners() {
  ipcMain.on('videoProgress', (_e, percent: number[]) => {
    win?.webContents.send('videoProgress', percent)
  })
  ipcMain.on('videoEnd', () => {
    win?.webContents.send('videoEnd')
    win?.webContents.send('showingMedia', false)
  })
  ipcMain.on('videoPaused', () => {
    win?.webContents.send('videoPaused')
  })
  ipcMain.on('readyToListen', () => {
    win?.webContents.send('readyToListen')
  })
  ipcMain.on('allowQuit', (_e, val: boolean) => {
    allowClose = val
  })
  screen.on('display-removed', () => {
    win?.webContents.send('displaysChanged')
  })
  screen.on('display-added', () => {
    win?.webContents.send('displaysChanged')
  })

  ipcMain.handle(
    'registerShortcut',
    (_e, { shortcut, fn }: { shortcut: string; fn: string }) => {
      const globalShortcut = require('electron').globalShortcut
      const functions: { [key: string]: () => void } = {
        toggleMediaWindow: () => {
          fadeWindow()
        },
        openPresentMode: () => {
          win?.webContents.send('openPresentMode')
        },
        toggleMusicShuffle: () => {
          win?.webContents.send('toggleMusicShuffle')
        },
        setObsScene: () => {
          win?.webContents.send('setObsScene', +shortcut.split('+')[1])
        },
        previousMediaItem: () => {
          win?.webContents.send('play', 'previous')
        },
        nextMediaItem: () => {
          win?.webContents.send('play', 'next')
        },
      }
      if (globalShortcut.isRegistered(shortcut)) {
        globalShortcut.unregister(shortcut)
      }
      return globalShortcut.register(shortcut, functions[fn])
    }
  )
  ipcMain.on('unregisterShortcut', (_e, shortcut: string) => {
    const globalShortcut = require('electron').globalShortcut
    if (globalShortcut.isRegistered(shortcut)) {
      globalShortcut.unregister(shortcut)
    }
  })
}