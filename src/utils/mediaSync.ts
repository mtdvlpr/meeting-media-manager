import type { Dayjs } from 'dayjs'

import { pathExists, stat, emptyDir, writeJson } from 'fs-extra'
import { basename, changeExt, extname, join } from 'upath'
import type {
  MeetingFile,
  SmallMediaFile,
  VideoFile,
  DateFormat,
} from '~~/types'

export function syncLocalRecurringMedia(baseDate: Dayjs) {
  const path = mediaPath()
  if (!path) return

  const meetings = useMediaStore().meetings

  const dates = [...meetings.keys()].filter((date) => {
    if (date === 'Recurring') return false
    const day = useNuxtApp().$dayjs(
      date,
      getPrefs<DateFormat>('app.outputFolderDateFormat'),
    )
    return (
      day.isValid() &&
      day.isBetween(baseDate, baseDate.add(6, 'days'), null, '[]')
    )
  })

  findAll(join(path, 'Recurring', '*')).forEach((recurringItem: string) => {
    dates.forEach((date) => {
      copy(recurringItem, join(path, date, basename(recurringItem)))
    })
  })
}

// export async function syncLocalRecurringMediaByDate(date: string) {
//   const path = mediaPath()
//   if (!path || !(await pathExists(join(path, date)))) return
//   findAll(join(path, 'Recurring', '*')).forEach((recurringItem: string) => {
//     copy(recurringItem, join(path, date, basename(recurringItem)))
//   })
// }

export function createMediaNamesByDate(date: string) {
  const statStore = useStatStore()
  const mediaStore = useMediaStore()
  const { $dayjs } = useNuxtApp()
  statStore.startPerf({
    func: 'createMediaNamesByDate',
    start: performance.now(),
  })

  const day = $dayjs(date, getPrefs<DateFormat>('app.outputFolderDateFormat'))
  const isWeDay = isMeetingDay(day) === 'we'
  let heading = '01'
  let i = 1
  const parts = mediaStore.meetings.get(date)
  if (parts) {
    for (const [par, media] of [...parts.entries()].sort(
      (a, b) => a[0] - b[0],
    )) {
      if (heading === '01' && par > BIBLE_READING_PAR_NR) {
        heading = '02'
        i = 1
      }
      let j = 0
      for (const item of media.filter((m) => !m.safeName)) {
        if (heading === '02' && item.pub?.includes('sjj')) {
          heading = '03'
          i = 1
        }
        item.safeName = `${isWeDay ? '' : heading + '-'}${(isWeDay ? i + 2 : i)
          .toString()
          .padStart(2, '0')}-${(j + 1).toString().padStart(2, '0')} -`
        if (!item.congSpecific) {
          if (item.queryInfo?.TargetParagraphNumberLabel) {
            item.safeName +=
              ' ' +
              (item.queryInfo.TargetParagraphNumberLabel === 9999
                ? translate('footnote')
                : translate('paragraph') +
                  ' ' +
                  item.queryInfo.TargetParagraphNumberLabel) +
              ' -'
          }
          if (item.pub?.includes('sjj')) {
            item.safeName += ` ${translate('song')}`
          }
          item.safeName = sanitize(
            `${item.safeName} ${item.title || ''}${extname(
              item.url || item.filepath || '',
            )}`,
            true,
          )
        }
        j++
      }
      i++
    }
    log.debug('meeting', parts)
    statStore.stopPerf({
      func: 'createMediaNamesByDate',
      stop: performance.now(),
    })
  }
}

export function createMediaNames() {
  const statStore = useStatStore()
  const mediaStore = useMediaStore()
  const { $dayjs } = useNuxtApp()
  statStore.startPerf({
    func: 'createMediaNames',
    start: performance.now(),
  })
  const meetings = mediaStore.meetings

  meetings.forEach((parts, date) => {
    let i = 1
    const day = $dayjs(date, getPrefs<DateFormat>('app.outputFolderDateFormat'))
    const isWeDay = isMeetingDay(day) === 'we'
    const sorted = [...parts.entries()].sort((a, b) => a[0] - b[0])

    let heading = '01'
    sorted.forEach(([par, media]) => {
      if (heading === '01' && par > BIBLE_READING_PAR_NR) {
        heading = '02'
        i = 1
      }

      media
        .filter((m) => !m.safeName)
        .forEach((item, j) => {
          if (heading === '02' && item.pub?.includes('sjj')) {
            heading = '03'
            i = 1
          }

          item.safeName = `${isWeDay ? '' : heading + '-'}${(isWeDay
            ? i + 2
            : i
          )
            .toString()
            .padStart(2, '0')}-${(j + 1).toString().padStart(2, '0')} -`
          if (!item.congSpecific) {
            if (item.queryInfo?.TargetParagraphNumberLabel) {
              item.safeName += ` ${translate('paragraph')} ${
                item.queryInfo.TargetParagraphNumberLabel
              } -`
            }
            if (item.pub?.includes('sjj')) {
              item.safeName += ` ${translate('song')}`
            }
            item.safeName = sanitize(
              `${item.safeName} ${item.title || ''}${extname(
                item.url || item.filepath || '',
              )}`,
              true,
            )
          }
        })
      i++
    })
  })
  log.debug('meetings', meetings)
  statStore.stopPerf({
    func: 'createMediaNames',
    stop: performance.now(),
  })
}

export async function downloadIfRequired({
  file,
  date,
  additional,
}: {
  file: VideoFile
  date?: string
  additional?: boolean
}): Promise<string> {
  const progressMap = useMediaStore().progress
  const downloadInProgress = progressMap.get(file.url)
  if (downloadInProgress) await downloadInProgress

  // Set extra properties
  file.downloadRequired = true
  file.cacheFilename = basename(file.url || '') || file.safeName
  file.cacheDir = pubPath(file)!
  file.cacheFile = join(file.cacheDir, file.cacheFilename!)
  file.destFilename = file.folder ? file.safeName : file.cacheFilename
  if (await pathExists(file.cacheFile)) {
    file.downloadRequired = file.filesize !== (await stat(file.cacheFile)).size
  }
  const subtitlesEnabled = getPrefs<boolean>('media.enableSubtitles')
  const subsLang = getPrefs<string>('media.langSubs')
  const statStore = useStatStore()
  if (file.downloadRequired) {
    try {
      if (extname(file.cacheFile) === '.jwpub') {
        await emptyDir(file.cacheDir)
      }
      const filePath = file.folder
        ? additional
          ? join(
              (getPrefs('cloud.path'),
              'Additional',
              file.folder!,
              file.destFilename ?? file.safeName),
            )
          : mediaPath(file)
        : undefined
      const destinations = [file.cacheFile]
      if (filePath) destinations.push(filePath)
      await fetchFile({ url: file.url, dest: destinations, date })
      if (filePath) {
        if (subtitlesEnabled && subsLang && file.subtitles) {
          try {
            await fetchFile({
              url: file.subtitles.url,
              dest: changeExt(filePath, 'vtt'),
              date,
            })
          } catch (e) {
            warn('errorDownloadSubs', { identifier: file.destFilename }, e)
          }
        } else {
          rm(changeExt(filePath, 'vtt'))
        }
      }
      statStore.setDownloads({
        origin: 'jwOrg',
        source: 'live',
        file,
      })
      if (extname(file.cacheFile) === '.jwpub') {
        await extractAllTo(file.cacheFile, file.cacheDir, date)
      }
    } catch (e) {
      warn('errorDownload', { identifier: file.destFilename }, e)
    }
  } else {
    if (file.folder) {
      const filePath = additional
        ? join(
            getPrefs('cloud.path'),
            'Additional',
            file.folder!,
            file.destFilename ?? file.safeName,
          )
        : mediaPath(file)
      if (filePath) {
        copy(file.cacheFile, filePath)
        if (subtitlesEnabled && subsLang && file.subtitles) {
          try {
            await fetchFile({
              url: file.subtitles.url,
              dest: changeExt(filePath, 'vtt'),
            })
          } catch (e) {
            warn('errorDownloadSubs', { identifier: file.destFilename }, e)
          }
        } else {
          rm(changeExt(filePath, 'vtt'))
        }
      }
    }
    if (
      extname(file.cacheFile) === '.jwpub' &&
      !findOne(join(file.cacheDir, '*.db'))
    ) {
      await extractAllTo(file.cacheFile, file.cacheDir, date)
    }
    statStore.setDownloads({
      origin: 'jwOrg',
      source: 'cache',
      file,
    })
  }
  return file.cacheFile
}
export async function syncJWMediaByDate(
  date: string,
  meetingType: string | undefined,
) {
  const { online } = useOnline()
  if (online.value) {
    if (meetingType === 'mw') {
      await getMwMedia(date)
    } else if (meetingType === 'we') {
      await getWeMedia(date)
    }

    createMediaNamesByDate(date)
    const meetingMedia = Object.fromEntries(
      Array.from(useMediaStore().meetings)
        .filter(([meetingMediaDate]) => meetingMediaDate === date)
        .map(([date, parts]) => [
          date,
          Object.fromEntries(
            Array.from(parts).map(([part, media]) => [
              part,
              media.filter(
                ({ congSpecific, hidden, isLocal }) =>
                  !congSpecific && !hidden && !isLocal,
              ),
            ]),
          ),
        ]),
    )
    for (const [date, parts] of Object.entries(meetingMedia)) {
      for (const [, media] of Object.entries(parts)) {
        for (const item of media) {
          await syncMediaItemByDate(date, item)
        }
      }
    }
  }
}
export async function syncJWMedia(
  dryrun: boolean,
  baseDate: Dayjs,
  setProgress: (loaded: number, total: number, global?: boolean) => void,
) {
  const { $dayjs } = useNuxtApp()
  const meetings = new Map(
    Array.from(useMediaStore().meetings)
      .filter(([date]) => {
        if (date === 'Recurring') return false
        const dateObj = $dayjs(
          date,
          getPrefs<DateFormat>('app.outputFolderDateFormat'),
        )
        return (
          dateObj.isValid() &&
          dateObj.isBetween(baseDate, baseDate.add(6, 'days'), null, '[]')
        )
      })
      .map(([date, parts]) => {
        const newParts = new Map(
          Array.from(parts).map(([part, media]) => {
            const newMedia = media.filter(
              ({ congSpecific, hidden, isLocal }) =>
                !congSpecific && !hidden && !isLocal, // Filter out cong specific media, hidden media and local media
            )
            return [part, newMedia]
          }),
        )
        return [date, newParts]
      }),
  )

  let total = 0
  meetings.forEach((parts) => {
    parts.forEach((media) => (total += media.length))
  })

  initProgress(total)
  const promises: Promise<void>[] = []

  meetings.forEach((parts, date) => {
    parts.forEach((media) => {
      media.forEach((item) => {
        if (!dryrun) {
          promises.push(syncMediaItem(date, item, setProgress))
        }
      })
    })
  })

  await Promise.allSettled(promises)
}

async function syncMediaItemByDate(date: string, item: MeetingFile) {
  if (item.filesize && (item.url || item.filepath)) {
    if (
      getPrefs('cloud.enable') &&
      (await pathExists(
        join(getPrefs('cloud.path'), 'Hidden', item.folder, item.safeName),
      ))
    ) {
      log.info(
        `%c[HIDDEN] [${date}] ${item.safeName}`,
        'background-color: #aae5aa; color: #004085;',
      )
    } else {
      log.info(
        `%c[jwOrg] [${date}] ${item.safeName}`,
        'background-color: #cce5ff; color: #004085;',
      )
      // Set markers for sign language videos
      const path = mediaPath()
      if (item.markers && path && item.folder && item.safeName) {
        const markers = Array.from(
          new Set(
            item.markers.markers.map(
              ({ duration, label, startTime, endTransitionDuration }) =>
                JSON.stringify({
                  duration,
                  label,
                  startTime,
                  endTransitionDuration,
                }),
            ),
          ),
        ).map((m) => JSON.parse(m))
        try {
          writeJson(
            join(path, item.folder, changeExt(item.safeName, 'json')),
            markers,
          )
        } catch (error) {
          log.error(error)
        }
      }
      if (item.url) {
        const newItem = JSON.parse(JSON.stringify(item))
        await downloadIfRequired({ file: newItem, date })
      } else if (path && item.filepath && item.folder && item.safeName) {
        const dest = join(path, item.folder, item.safeName)
        await copy(item.filepath, dest)
      }
    }
  } else {
    warn(
      'warnFileNotAvailable',
      {
        persistent: true,
        identifier: [
          item.queryInfo?.KeySymbol,
          item.queryInfo?.Track,
          item.queryInfo?.IssueTagNumber,
        ]
          .filter(Boolean)
          .join('_'),
      },
      item,
    )
  }
}

async function syncMediaItem(
  date: string,
  item: MeetingFile,
  setProgress: (loaded: number, total: number, global?: boolean) => void,
): Promise<void> {
  if (item.filesize && (item.url || item.filepath)) {
    log.info(
      `%c[jwOrg] [${date}] ${item.safeName}`,
      'background-color: #cce5ff; color: #004085;',
    )
    // Set markers for sign language videos
    const path = mediaPath()
    if (item.markers && path) {
      const markers = Array.from(
        new Set(
          item.markers.markers.map(
            ({ duration, label, startTime, endTransitionDuration }) =>
              JSON.stringify({
                duration,
                label,
                startTime,
                endTransitionDuration,
              }),
          ),
        ),
      ).map((m) => JSON.parse(m))
      writeJson(
        join(path, item.folder!, changeExt(item.safeName!, 'json')),
        markers,
      )
    }

    // Prevent duplicates
    const duplicate = path
      ? findOne(
          join(
            path,
            item.folder,
            '*' +
              item.safeName
                ?.substring(MAX_PREFIX_LENGTH)
                .replace('.svg', '.png'),
          ),
        )
      : null

    if (
      duplicate &&
      item.safeName &&
      basename(duplicate) !== item.safeName &&
      ((await stat(duplicate)).size === item.filesize ||
        extname(item.safeName) === '.svg')
    ) {
      rename(
        duplicate,
        basename(duplicate),
        item.safeName.replace('.svg', '.png'),
      )
    } else if (item.url) {
      const store = useMediaStore()
      const newItem = <SmallMediaFile>JSON.parse(JSON.stringify(item))
      store.setProgress({
        key: newItem.url,
        promise: downloadIfRequired({
          file: newItem,
          date,
        }),
      })
      await store.progress.get(newItem.url)
    } else if (path && item.filepath && item.folder && item.safeName) {
      await copy(item.filepath, join(path, item.folder, item.safeName))
    }
  } else {
    warn(
      'warnFileNotAvailable',
      {
        persistent: true,
        identifier: [
          item.queryInfo?.KeySymbol,
          item.queryInfo?.Track,
          item.queryInfo?.IssueTagNumber,
        ]
          .filter(Boolean)
          .join('_'),
      },
      item,
    )
  }
  increaseProgress(setProgress)
}

export function addMediaItemToPart(
  date: string,
  par: number,
  media: MeetingFile,
  source?: string,
) {
  const store = useMediaStore()
  const mediaList = store.get({
    date,
    par,
  })

  media.uniqueId = [par, source, media.checksum, media.filepath]
    .filter(Boolean)
    .toString()

  if (
    !media.uniqueId ||
    (!mediaList
      .flat()
      .map((item) => item.uniqueId)
      .filter(Boolean)
      .includes(media.uniqueId) &&
      !mediaList
        .flat()
        .map((item) => item.checksum)
        .filter(Boolean)
        .includes(media.checksum))
  ) {
    media.folder = date
    store.set({
      date,
      par,
      media,
    })
  }
}

let progress = 0
let total = 0

function initProgress(amount: number): void {
  progress = 0
  total = amount
}

function increaseProgress(
  setProgress: (loaded: number, total: number, global?: boolean) => void,
): void {
  progress++
  setProgress(progress, total, true)
}
