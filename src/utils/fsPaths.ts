import { platform } from 'os'
import { ipcRenderer } from 'electron'
import { ensureDirSync, readJsonSync } from 'fs-extra'
import { basename, dirname, join, joinSafe } from 'upath'
import type { MeetingFile, ShortJWLang } from '~~/types'

export function appPath() {
  const store = storePath()
  return store ? dirname(store) : undefined
}

export function pubPath(file?: MeetingFile) {
  // url: something/{pub}_{lang}.jwpub or something/{pub}_{lang}_{track}.mp4
  let validMediaLangs: ShortJWLang[] = []
  if (file) {
    log.debug('Pub path', file)
    try {
      validMediaLangs = <ShortJWLang[]>(
        (readJsonSync(join(appPath(), 'langs.json')) ?? '[]')
      )
    } catch (e) {
      log.error(e)
      validMediaLangs = []
    }
  }

  let mediaFolder = basename(file?.url || '_')
    .split('_')[1]
    .split('.')[0]

  if (
    !mediaFolder ||
    !validMediaLangs.find((l) => l.langcode === mediaFolder)
  ) {
    mediaFolder = basename(file?.queryInfo?.FilePath || '_').split('_')[1]
  }

  if (
    !mediaFolder ||
    !validMediaLangs.find((l) => l.langcode === mediaFolder)
  ) {
    try {
      const matches = file?.queryInfo?.Link?.match(/\/(.*)\//)
      if (matches && matches.length > 0) {
        mediaFolder = matches.pop()!.split(':')[0]
      }
    } catch (e) {
      log.error(e)
    }
  }

  if (
    !mediaFolder ||
    !validMediaLangs.find((l) => l.langcode === mediaFolder)
  ) {
    mediaFolder = getPrefs<string>('media.lang')
  }
  if (!mediaFolder) return

  if (file) log.debug('Pub lang', mediaFolder)

  const pPath = joinSafe(
    getPrefs<string>('app.customCachePath') || appPath(),
    'Publications',
    mediaFolder,
  )
  try {
    ensureDirSync(pPath)
  } catch (e) {
    warn('errorSetVars', { identifier: pPath }, e)
  }

  if (!file) return pPath

  // Get path for specific file
  const pubFolder = (
    file.pub ||
    file.queryInfo?.KeySymbol ||
    file.queryInfo?.MultiMeps ||
    file.primaryCategory ||
    'unknown'
  ).toString()
  const issueFolder = (
    file.issue ||
    file.queryInfo?.IssueTagNumber ||
    0
  ).toString()
  const trackFolder = (file.track || file.queryInfo?.Track || 0).toString()
  return joinSafe(pPath, pubFolder, issueFolder, trackFolder)
}

export function mediaPath(file?: MeetingFile): string | undefined {
  const mediaLang = getPrefs<string>('media.lang')
  const outputPath = getPrefs<string>('app.localOutputPath')
  if (!outputPath || !mediaLang) return undefined

  const mPath = joinSafe(outputPath, mediaLang)

  try {
    ensureDirSync(mPath)
  } catch (e) {
    warn('errorSetVars', { identifier: mPath }, e)
  }

  if (!file) return mPath

  return joinSafe(mPath, file.folder!, file.destFilename ?? file.safeName)
}

export async function localFontPath(font: string) {
  return join(
    getPrefs<string>('app.customCachePath') ||
      appPath() ||
      ((await ipcRenderer.invoke('userData')) as Promise<string>),
    'Fonts',
    basename(font),
  )
}

export async function wtFontPath() {
  const appDataPath = await ipcRenderer.invoke('appData')
  const { sync } = await import('fast-glob')
  const localAppData = sync(joinSafe(appDataPath, '../local'), {
    onlyDirectories: true,
  })
  let path = appDataPath
  if (platform() === 'win32' && localAppData.length > 0) {
    path = localAppData[0]
  }
  return join(
    path,
    'Packages',
    '*WatchtowerBibleandTractSo*',
    'LocalState',
    'www',
    'webapp',
    'fonts',
  )
}

export async function ytPath(lang?: string) {
  const ytLang =
    lang ||
    getPrefs<string>('media.lang') ||
    getPrefs<string>('media.langFallback') ||
    'E'
  const cachePath =
    getPrefs<string>('app.customCachePath') ||
    appPath() ||
    ((await ipcRenderer.invoke('userData')) as Promise<string>)
  return joinSafe(
    cachePath,
    'Publications',
    ytLang,
    `yeartext-${ytLang}-${new Date().getFullYear().toString()}`,
  )
}
