import { platform } from 'os'
import { join, normalize } from 'path'
import { existsSync } from 'fs'
import {
  app,
  BrowserWindow,
  ipcMain,
  nativeTheme,
  shell,
  dialog,
  type OpenDialogOptions,
  type RelaunchOptions,
  session,
} from 'electron'
import { init } from '@sentry/electron/main'
import { initRenderer } from 'electron-store'
import BrowserWinHandler from './BrowserWinHandler'
import { initAutoUpdater } from './autoUpdater'
import { initMainWindow } from './mainWindow'
import { initWebsiteListeners } from './websiteController'
import { initMediaWinListeners } from './mediaWindow'
import { getScreenInfo } from './utils'

require('dotenv').config()
const isDev = process.env.NODE_ENV === 'development'
export const appShortName = 'M³'
export const appLongName = 'Meeting Media Manager'
export const AR_WIDTH = 16
export const AR_HEIGHT = 9

// TODO: Remove this before official release
app.setPath(
  'userData',
  join(
    app.getPath('appData'),
    appLongName.toLowerCase().replace(' ', '-') + '-test',
  ),
)

if (isDev) {
  app.setPath(
    'userData',
    join(
      app.getPath('appData'),
      appLongName.toLowerCase().replace(' ', '-') + '-dev',
    ),
  )
}

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

// Allow listeners to work in iFrames
app.commandLine.appendSwitch('disable-site-isolation-trials')

const initSentry =
  !!process.env.SENTRY_DSN &&
  !!process.env.SENTRY_ORG &&
  !!process.env.SENTRY_PROJECT &&
  !!process.env.SENTRY_AUTH_TOKEN

if (initSentry) {
  init({
    environment: isDev ? 'development' : 'production',
    dist: platform().replace('32', ''),
    enabled: !process.env.SENTRY_DISABLE,
    release: `meeting-media-manager@${
      isDev || !process.env.CI ? 'dev' : app.getVersion()
    }`,
    dsn: process.env.SENTRY_DSN,
  })
}

// Initialize the store
initRenderer()

// Disable hardware acceleration if the user turned it off
try {
  if (existsSync(join(app.getPath('userData'), 'disableHardwareAcceleration')))
    app.disableHardwareAcceleration()
} catch (e) {
  // eslint-disable-next-line no-console
  console.error(e)
}

let win: BrowserWindow | undefined
let winHandler: BrowserWinHandler | undefined

async function boot() {
  winHandler = await initMainWindow()
  win = await winHandler.created()
  initAutoUpdater(winHandler)
  initWebsiteListeners()
  initMediaWinListeners()

  if (process.env.VITE_DEV_SERVER_URL) {
    win.webContents.openDevTools({ mode: 'detach' })
  }

  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['*://*.jw.org/*'] },
    (details, resolve) => {
      let cookies = 'ckLang=E;'
      if (details.requestHeaders.cookie) {
        cookies += ' ' + details.requestHeaders.cookie
      } else if (details.requestHeaders.Cookie) {
        cookies += ' ' + details.requestHeaders.Cookie
      }
      details.requestHeaders = {
        ...details.requestHeaders,
        Cookie: cookies,
        'User-Agent': details.requestHeaders['User-Agent'].replace(
          /Electron\/\d+\.\d+\.\d+ /,
          '',
        ),
      }
      resolve({ requestHeaders: details.requestHeaders })
    },
  )

  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ['*://*.jw.org/*'] },
    (details, resolve) => {
      if (!details.responseHeaders) details.responseHeaders = {}
      details.responseHeaders['x-frame-options'] = ['ALLOWALL']
      details.responseHeaders['content-security-policy'] = []
      const setCookie = details.responseHeaders['set-cookie'] as
        | string[]
        | undefined
      if (setCookie) {
        details.responseHeaders['set-cookie'] = setCookie.map((c) =>
          c
            .replace('HttpOnly', 'Secure')
            .replace('Secure', 'SameSite=None; Secure'),
        )
      }
      resolve({ responseHeaders: details.responseHeaders })
    },
  )

  app.on('window-all-closed', () => {
    app.exit()
  })
}

// Prevent opening the app multiple times
const gotTheLock = app.requestSingleInstanceLock()
if (gotTheLock) {
  app.on('second-instance', () => {
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.focus()
  })

  nativeTheme.on('updated', () => {
    win?.webContents.send(
      'themeUpdated',
      nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
    )
  })

  ipcMain.handle('userData', () => normalize(app.getPath('userData')))
  ipcMain.handle('appData', () => normalize(app.getPath('appData')))
  ipcMain.handle('isDev', () => isDev)
  ipcMain.handle('downloads', () => normalize(app.getPath('downloads')))
  ipcMain.handle('appVersion', () => app.getVersion())
  ipcMain.handle('getScreenInfo', () => getScreenInfo())
  ipcMain.handle('theme', () =>
    nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
  )

  ipcMain.handle('openDialog', async (_e, options: OpenDialogOptions) => {
    const result = await dialog.showOpenDialog(options)
    return result
  })

  ipcMain.on('setTheme', (_e, val: 'system' | 'light' | 'dark') => {
    nativeTheme.themeSource = val
  })

  ipcMain.on('runAtBoot', (_e, val: boolean) => {
    if (platform() !== 'linux') {
      app.setLoginItemSettings({ openAtLogin: val })
    }
  })

  ipcMain.on('exit', () => {
    app.exit()
  })

  ipcMain.on('openPath', (_e, path: string) => {
    shell.openPath(path.replaceAll('/', platform() === 'win32' ? '\\' : '/'))
  })

  ipcMain.on('restart', () => {
    const RESTART_CODE = 250
    if (isDev) {
      app.exit(RESTART_CODE)
    } else {
      let options: RelaunchOptions = {}
      if (process.env.APPIMAGE) {
        options = {
          execPath: process.env.APPIMAGE,
          args: ['--appimage-extract-and-run'],
        }
      }
      app.relaunch(options)
      app.quit()
    }
  })

  app.whenReady().then(boot)
} else {
  app.quit()
}
