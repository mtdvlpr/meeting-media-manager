import { platform } from 'os'
import {
  BrowserWindow,
  type BrowserWindowConstructorOptions,
  ipcMain,
  type Point,
} from 'electron'
import { AR_HEIGHT, AR_WIDTH } from './main'
import BrowserWinHandler from './BrowserWinHandler'
import { getMainWindow } from './mainWindow'
import { getMediaWin, getMediaWinHandler } from './mediaWindow'

let websiteController: BrowserWindow | null = null
let websiteControllerWinHandler: BrowserWinHandler | null = null

export function initWebsiteListeners() {
  ipcMain.removeAllListeners('openWebsite')
  ipcMain.on('openWebsite', (_e, url: string) => {
    openWebsite(url)
  })

  ipcMain.removeAllListeners('sendSize')
  ipcMain.on('sendSize', () => {
    websiteController?.webContents.send(
      'mediaSize',
      getMediaWin()?.getContentSize(),
    )
    websiteController?.webContents.send(
      'winSize',
      websiteController.getContentSize(),
    )
  })

  ipcMain.removeAllListeners('scrollWebsite')
  ipcMain.on('scrollWebsite', (_e, pos: Point) => {
    getMediaWin()?.webContents.send('scrollWebsite', pos)
  })

  ipcMain.removeAllListeners('clickOnWebsite')
  ipcMain.on(
    'clickOnWebsite',
    (
      _e,
      target: {
        tag: string
        id: string
        className?: string
        text: string | null
        alt: string | null
        src: string | null
        href: string | null
      },
    ) => {
      getMediaWin()?.webContents.send('clickOnWebsite', target)
    },
  )
}

async function openWebsite(url: string) {
  const win = getMainWindow()
  const mediaWin = getMediaWin()
  const mediaWinHandler = getMediaWinHandler()
  win.webContents.send('showingMedia', [true, true])
  if (websiteControllerWinHandler) {
    mediaWinHandler?.loadPage('/browser?url=' + url)
    websiteControllerWinHandler.loadPage('/browser?controller=true&url=' + url)
    return
  }

  const MIN_WIDTH = 1280
  const MIN_HEIGHT = 720
  mediaWin?.setMinimumSize(MIN_WIDTH, MIN_HEIGHT)
  mediaWinHandler?.loadPage('/browser?url=' + url)

  const windowOpts: BrowserWindowConstructorOptions = {
    x: win.getBounds().x,
    y: win.getBounds().y,
  }

  const mediaFullscreen = mediaWin?.isFullScreen()

  if (!mediaFullscreen) {
    windowOpts.width = mediaWin?.getBounds().width
    windowOpts.height = mediaWin?.getBounds().height
  }
  websiteControllerWinHandler = createWebsiteController(
    windowOpts,
    mediaFullscreen,
  )
  websiteController = await websiteControllerWinHandler.created()
  websiteControllerWinHandler.loadPage('/browser?controller=true&url=' + url)

  websiteController
    .on('resize', () => {
      if (!websiteController?.isMaximized()) {
        websiteController?.webContents.send(
          'mediaSize',
          mediaWin?.getContentSize(),
        )
        websiteController?.webContents.send(
          'winSize',
          websiteController.getContentSize(),
        )
      }
    })
    // Not available for Linux
    .on('resized', () => {
      setContentAspectRatio(websiteController)
    })
    .on('unmaximize', () => {
      websiteController?.webContents.send(
        'mediaSize',
        mediaWin?.getContentSize(),
      )
      websiteController?.webContents.send(
        'winSize',
        websiteController.getContentSize(),
      )
    })
    .on('maximize', () => {
      websiteController?.webContents.send('mediaSize', [0, 0])
      websiteController?.webContents.send('winSize', [0, 0])
    })
    .on('close', () => {
      win.webContents.send('showingMedia', [false, false])
      mediaWinHandler?.loadPage('/media')
      const MIN_WIDTH = 195
      const MIN_HEIGHT = 110
      mediaWin?.setMinimumSize(MIN_WIDTH, MIN_HEIGHT)
      websiteController = null
      websiteControllerWinHandler = null
    })

  websiteController.webContents.send('mediaSize', mediaWin?.getContentSize())
  websiteController.webContents.send(
    'winSize',
    websiteController.getContentSize(),
  )
}

function setContentAspectRatio(win: BrowserWindow | null) {
  if (!win) return
  const [windowWidth, windowHeight] = win.getSize()
  const [contentWidth, contentHeight] = win.getContentSize()
  const simulatedContentHeight = contentWidth * (AR_HEIGHT / AR_WIDTH)
  const aspectRatio =
    windowWidth / (windowHeight - contentHeight + simulatedContentHeight)
  win.setAspectRatio(aspectRatio)
}

function createWebsiteController(
  opts: BrowserWindowConstructorOptions,
  maximize = true,
) {
  const winHandler = new BrowserWinHandler({
    title: 'Website Controller Window',
    minHeight: 110,
    minWidth: 195,
    width: 1280,
    height: 720,
    ...opts,
  })

  const win = winHandler.browserWindow!
  win.on('ready-to-show', () => {
    if (platform() === 'linux') {
      win.setAspectRatio(AR_WIDTH / AR_HEIGHT)
    } else {
      setContentAspectRatio(win)
    }
  })

  if (maximize) win.maximize()
  return winHandler
}

export function getWebsiteController() {
  return websiteController
}

export function getWebsiteControllerWinHandler() {
  return websiteControllerWinHandler
}
