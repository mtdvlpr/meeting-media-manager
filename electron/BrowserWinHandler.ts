import { EventEmitter } from 'events'
import { platform } from 'os'
import { join } from 'path'
import {
  BrowserWindow,
  app,
  shell,
  type BrowserWindowConstructorOptions,
} from 'electron'
import { appLongName } from './main'
const isDev = process.env.NODE_ENV === 'development'

process.env.ROOT = join(__dirname, '..')
process.env.DIST = join(process.env.ROOT, 'dist-electron')
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? join(process.env.ROOT, 'src/public')
  : join(process.env.ROOT, 'output')

export default class BrowserWinHandler {
  _eventEmitter: EventEmitter
  allowRecreate: boolean
  options: BrowserWindowConstructorOptions
  browserWindow: BrowserWindow | null

  constructor(options: BrowserWindowConstructorOptions, allowRecreate = true) {
    this._eventEmitter = new EventEmitter()
    this.allowRecreate = allowRecreate
    this.options = options
    this.browserWindow = null
    this._createInstance()
  }

  _createInstance() {
    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    if (app.isReady()) this._create()
    else {
      app.once('ready', () => {
        this._create()
      })
    }

    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (!this.allowRecreate) return
    app.on('activate', () => {
      this._recreate()
    })
  }

  _create() {
    this.browserWindow = new BrowserWindow({
      ...this.options,
      webPreferences: {
        ...this.options.webPreferences,
        backgroundThrottling: false,
        webSecurity: false, // disable on dev to allow loading local resources
        nodeIntegration: true, // allow loading modules via the require () function
        nodeIntegrationInWorker: true,
        contextIsolation: false, // https://github.com/electron/electron/issues/18037#issuecomment-806320028
      },
    })

    this.browserWindow.setMenuBarVisibility(isDev)

    // open external urls in a browser and prevent default
    this.browserWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url)
      return { action: 'deny' }
    })

    if (platform() === 'win32')
      this.browserWindow.setAppDetails({
        appId: appLongName,
      })

    this.browserWindow.on('closed', () => {
      // Dereference the window object
      this.browserWindow = null
    })
    this._eventEmitter.emit('created')
  }

  _recreate() {
    if (this.browserWindow === null) this._create()
  }

  onCreated(resolve: (win: BrowserWindow) => void) {
    if (this.browserWindow !== null) {
      resolve(this.browserWindow)
      return
    }
    this._eventEmitter.once('created', () => {
      resolve(this.browserWindow!)
    })
  }

  send(channel: string, ...args: any[]) {
    if (this.browserWindow)
      this.browserWindow.webContents.send(channel, ...args)
  }

  loadPage(pagePath: string) {
    if (!this.browserWindow)
      return Promise.reject(
        new Error("The page could not be loaded before win 'created' event"),
      )
    const serverUrl = process.env.VITE_DEV_SERVER_URL
      ? process.env.VITE_DEV_SERVER_URL
      : 'file://' + join(process.env.VITE_PUBLIC!, 'index.html')
    const fullPath = serverUrl + '#' + pagePath
    this.browserWindow.loadURL(fullPath)
  }

  created(): Promise<BrowserWindow> {
    return new Promise((resolve) => {
      this.onCreated(() => {
        resolve(this.browserWindow!)
      })
    })
  }
}
