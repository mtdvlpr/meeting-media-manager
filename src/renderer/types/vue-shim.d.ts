import { Scene } from 'obs-websocket-js'
import { WebDAVClient } from 'webdav/web'
/* eslint-disable import/named */
import { NuxtAxiosInstance } from '@nuxtjs/axios'
import { Options } from 'fast-glob'
import { Database } from 'sql.js'
import Vue from 'vue'
import {
  MultiMediaImage,
  SmallMediaFile,
  ElectronStore,
  ShortJWLang,
} from '~/types'

interface CustomProps {
  $appPath: () => string
  $appVersion: () => Promise<string>
  $bugURL: () => string
  $connect: (
    host: string,
    username: string,
    password: string,
    dir: string = '/'
  ) => Promise<WebDAVClient | string>
  $convertToMP4: (
    baseDate: Dayjs,
    now: Dayjs,
    setProgress: Function
  ) => Promise<void>
  $convertToVLC: () => void
  $convertUnusableFiles: (dir: string) => Promise<void>
  $copy: (src: string, dest: string) => void
  $createMediaNames: () => void
  $downloadIfRequired: (
    file: SmallMediaFile,
    setProgress?: Function
  ) => Promise<string>
  $error: (message: string) => void
  $escapeHTML: (str: string) => string
  $extractAllTo: (zip: string, file: string, dest: string) => void
  $findAll: (path: string | string[], options?: Options) => string[]
  $findOne: (path: string | string[], options?: Options) => string
  $flash: (message: string, type?: string) => void
  $forcePrefs: () => Promise<void>
  $getAllPrefs: () => ElectronStore
  $getCongPrefs: () => Promise<{ name: string | null; path: string }[]>
  $getDb: ({
    file,
    pub,
    issue,
  }: {
    file?: Buffer
    pub?: string
    issue?: string
  }) => Promise<Database>
  $getDbFromJWPUB: (
    pub?: string,
    issue?: string,
    setProgess?: Function,
    localPath: string = ''
  ) => Promise<Database>
  $getDocumentMultiMedia: (
    db: Database,
    docId: number | null,
    mepsId?: number,
    memOnly: boolean = false
  ) => Promise<(SmallMediaFile | MultiMediaImage)[]>
  $getLocalJWLangs: () => ShortJWLang[]
  $getJWLangs: (forceReload: boolean = false) => Promise<ShortJWLang[]>
  $getPrefs: (key: string) => unknown
  $getMediaLinks: (mediaItem: {
    docId?: number
    track?: number
    pubSymbol: string
    issue?: string
    format?: string
    lang?: string
  }) => Promise<SmallMediaFile[]>
  $getMediaWindowDestination: () => Promise<{
    destination: number
    type: 'window' | 'fullscreen'
  }>
  $getMwMedia: (date: string, setProgress?: Function) => Promise<void>
  $getScenes: (current: boolean = false) => Promise<Scene[] | string>
  $getWeMedia: (date: string, setProgress?: Function) => Promise<void>
  $getYearText: (force: boolean = false) => Promise<string>
  $getZipContentsByExt: (zip: string, ext: string) => Buffer
  $getZipContentsByName: (zip: string, name: string) => Buffer
  $initStore: (name: string) => void
  $isAudio: (filepath: string) => boolean
  $isImage: (filepath: string) => boolean
  $isVideo: (filepath: string) => boolean
  $log: {
    debug: (msg: any, ...args: any[]) => void
    info: (msg: any, ...args: any[]) => void
    warn: (msg: any, ...args: any[]) => void
    error: (msg: any, ...args: any[]) => void
  }
  $mediaItems: NuxtAxiosInstance
  $mediaPath: (file?: SmallMediaFile) => string
  $migrate2280: (key: string, newVal: any) => { key: string; val: unknown }
  $prefsInitialized: () => boolean
  $printStats: () => void
  $pubMedia: NuxtAxiosInstance
  $pubPath: (file?: SmallMediaFile) => string
  $query: (db: Database, query: string) => unknown[]
  $refreshBackgroundImgPreview: (force: boolean = false) => Promise<string>
  $removeCong: (path: string) => void
  $rename: (
    path: string,
    oldName: string,
    newName: string,
    action?: string,
    type?: string
  ) => void
  $renameAll: (
    dir: string,
    search: string,
    newName: string,
    action?: string,
    type?: string
  ) => void
  $renamePubs: (oldVal: string, newVal: string) => Promise<void>
  $resetPrefs: () => void
  $rm: (files: string | string[]) => void
  $sanitize: (name: string, isFile: boolean = false) => string
  $setAllPrefs: (settings: ElectronStore) => void
  $setDb: (pub: string, issue: string, db: Database) => void
  $setPrefs: (key: string, value: unknown) => void
  $setScene: (scene: string) => Promise<void>
  $setShortcut: (
    shortcut: string,
    fn: string,
    domain: string = 'mediaWindow'
  ) => Promise<void>
  $shuffleMusic: (stop: boolean = false) => Promise<void>
  $storePath: () => string
  $success: (message: string) => void
  $switchCong: (path: string) => void
  $syncJWMedia: (
    dryrun: boolean,
    baseDate: Dayjs,
    setProgress: Function
  ) => Promise<void>
  $syncLocalRecurringMedia: (baseDate: Dayjs) => void
  $toggleMediaWindow: (action?: string) => Promise<void>
  $unsetPrefs: (key: keyof ElectronStore) => void
  $unsetShortcuts: (filter: string = 'all') => void
  $updateContent: () => Promise<void>
  $warn: (message: string) => void
  $write: (file: string, data: string | NodeJS.ArrayBufferView) => void
  $wtFontPath: () => Promise<string>
  $yeartext: NuxtAxiosInstance
  $ytPath: (lang?: string) => string
}

declare module 'vue/types/vue' {
  interface Vue extends CustomProps {}
}

declare module '*.vue' {
  export default Vue
}

declare module '@nuxt/types' {
  interface Context extends CustomProps {}

  interface Configuration extends CustomProps {}
}
