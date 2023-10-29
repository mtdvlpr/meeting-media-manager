import type { Dayjs } from 'dayjs'
import { stat } from 'fs-extra'
import { join, extname, basename } from 'upath'
import type { LocaleObject } from '#i18n'
import type { MeetingFile, DateFormat, CongFile } from '~~/types'

export function getCongMedia(baseDate: Dayjs, now: Dayjs) {
  const statStore = useStatStore()
  const mediaStore = useMediaStore()
  statStore.startPerf({
    func: 'getCongMedia',
    start: performance.now(),
  })
  const tree = updateContentsTree()
  const mediaFolder = tree.find(({ basename }) => basename === 'Media')
  const hiddenFolder = tree.find(({ basename }) => basename === 'Hidden')
  const dateFormat = getPrefs<DateFormat>('app.outputFolderDateFormat')
  const dates = ['Recurring', now.format(dateFormat)]
  let day = now.add(1, 'day')
  while (day.isBetween(baseDate, baseDate.add(6, 'days'), null, '[]')) {
    dates.push(day.format(dateFormat))
    day = day.add(1, 'day')
  }

  dates.forEach((date) => {
    mediaStore.setMultiple({
      date,
      par: -1,
      media: [],
      overwrite: true,
    })
  })

  // Get cong media
  if (mediaFolder?.children) {
    let recurringMedia: MeetingFile[] = []
    const { $dayjs } = useNuxtApp()
    mediaFolder.children
      .filter((date) => !!date.children)
      .forEach((date) => {
        const day = $dayjs(date.basename, dateFormat)
        const isRecurring = date.basename === 'Recurring'
        const isMeetingDay =
          day.isValid() &&
          day.isBetween(baseDate, baseDate.add(6, 'days'), null, '[]') &&
          now.isSameOrBefore(day)

        if (isRecurring || isMeetingDay) {
          const media: MeetingFile[] =
            date.children?.map((mediaFile) => {
              return <MeetingFile>{
                safeName: mediaFile.basename,
                congSpecific: true,
                filesize: mediaFile.size,
                folder: date.basename,
                url: mediaFile.filename,
              }
            }) ?? []
          mediaStore.setMultiple({
            date: date.basename,
            par: -1,
            media,
            overwrite: true,
          })
          if (isRecurring) {
            recurringMedia = cloneDeep(media)
          }
        }
      })

    // Set recurring media for each date
    dates.forEach((date) => {
      mediaStore.setMultiple({
        date,
        par: -1,
        media: cloneDeep(recurringMedia)
          .map((m) => {
            m.folder = date
            m.recurring = true
            return m
          })
          .filter((m) => {
            const media = mediaStore.meetings.get(date)?.get(-1)
            if (media) {
              return !media.find(({ safeName }) => safeName === m.safeName)
            } else {
              return true
            }
          }),
      })
    })
  }

  // Set hidden media
  if (hiddenFolder?.children) {
    const { $dayjs } = useNuxtApp()
    const meetings = mediaStore.meetings

    hiddenFolder.children
      .filter((date) => !!date.children)
      .forEach((date) => {
        const mediaMap = meetings.get(date.basename)
        const day = $dayjs(date.basename, dateFormat)
        const isMeetingDay =
          day.isValid() &&
          day.isBetween(baseDate, baseDate.add(6, 'days'), null, '[]') &&
          now.isSameOrBefore(day)

        if (isMeetingDay && mediaMap) {
          date.children?.forEach((hiddenFile) => {
            let found = false
            mediaMap.forEach((media, par) => {
              if (found) return
              const result = media.find(
                ({ safeName }) => safeName === hiddenFile.basename,
              )
              if (result) {
                mediaStore.setHidden({
                  date: date.basename,
                  par,
                  mediaName: hiddenFile.basename,
                  hidden: true,
                })

                // Remove hidden media if it was already downloaded
                rm(join(mediaPath(), date.basename, hiddenFile.basename))
                log.info(
                  '%c[hiddenMedia] [' +
                    date.basename +
                    '] ' +
                    hiddenFile.basename,
                  'background-color: #fff3cd; color: #856404;',
                )
                found = true
              }
            })
          })
        }
      })
  }
  statStore.stopPerf({
    func: 'getCongMedia',
    stop: performance.now(),
  })
}

export function getCongMediaByDate(date: string, isMeeting: boolean) {
  const mediaStore = useMediaStore()
  const { meetings } = useMediaStore()
  const mediaMap = meetings.get(date)
  const tree = updateContentsTree()
  const mediaFolder = tree.find(({ basename }) => basename === 'Media')
  const mediaDayFolder = mediaFolder?.children?.find(
    ({ basename }) => basename === date,
  )
  const recurringFolder = mediaFolder?.children?.find(
    ({ basename }) => basename === 'Recurring',
  )
  const hiddenDayFolder = tree
    .find(({ basename }) => basename === 'Hidden')
    ?.children?.find(({ basename }) => basename === date)
  const dayMedia: MeetingFile[] =
    mediaDayFolder?.children?.map(
      (mediaFile: { basename: any; size: any; filename: any }) => {
        return <MeetingFile>{
          safeName: mediaFile.basename,
          congSpecific: true,
          filesize: mediaFile.size,
          folder: date,
          url: mediaFile.filename,
        }
      },
    ) ?? []
  const recurringMedia: MeetingFile[] =
    recurringFolder?.children?.map(
      (mediaFile: { basename: any; size: any; filename: any }) => {
        return <MeetingFile>{
          safeName: mediaFile.basename,
          congSpecific: true,
          filesize: mediaFile.size,
          folder: date,
          recurring: true,
          url: mediaFile.filename,
        }
      },
    ) ?? []
  const combinedMedia = [...dayMedia, ...(isMeeting ? recurringMedia : [])]
  if (combinedMedia.length > 0) {
    mediaStore.setMultiple({
      date,
      par: -1,
      media: combinedMedia,
      overwrite: true,
    })
  }
  // Set hidden media
  for (const hiddenFile of hiddenDayFolder?.children ?? []) {
    let found = false
    for (const [par, media] of mediaMap?.entries() ?? []) {
      if (found) break
      const result = media.find(
        ({ safeName }) => safeName === hiddenFile.basename,
      )
      if (result) {
        mediaStore.setHidden({
          date,
          par,
          mediaName: hiddenFile.basename,
          hidden: true,
        })
        // Remove hidden media if it was already downloaded
        rm(join(mediaPath(), date, hiddenFile.basename))
        log.info(
          '%c[hiddenMedia] [' + date + '] ' + hiddenFile.basename,
          'background-color: #fff3cd; color: #856404;',
        )
        found = true
      }
    }
  }
}
export async function syncCongMediaByDate(date: string) {
  const promises = Array.from(
    useMediaStore()
      .meetings.get(date)
      ?.get(-1)
      ?.filter((i) => i.congSpecific) || [],
  ).flatMap((mediaItem) => syncCongMediaItem(date, mediaItem))
  await Promise.all(promises)
}

export async function syncCongMedia(
  baseDate: Dayjs,
  setProgress: (loaded: number, total: number, global?: boolean) => void,
) {
  const { $dayjs } = useNuxtApp()
  const statStore = useStatStore()
  const mediaStore = useMediaStore()
  statStore.startPerf({
    func: 'syncCongMedia',
    start: performance.now(),
  })
  const meetings = new Map(
    Array.from(mediaStore.meetings)
      .filter(([date]) => {
        if (date === 'Recurring') return true
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
            const newMedia = media.filter(({ congSpecific }) => !!congSpecific)
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
        promises.push(syncCongMediaItem(date, item, setProgress))
      })
    })
  })

  await Promise.allSettled(promises)

  statStore.stopPerf({
    func: 'syncCongMedia',
    stop: performance.now(),
  })
}

// Sync a single media item to the local disk
async function syncCongMediaItem(
  date: string,
  item: MeetingFile,
  setProgress?: (loaded: number, total: number, global?: boolean) => void,
): Promise<void> {
  if (!item.hidden && !item.isLocal) {
    if (item.filesize) {
      const statStore = useStatStore()
      log.info(
        `%c[congMedia] [${date}] ${item.safeName}`,
        'background-color: #d1ecf1; color: #0c5460',
      )

      // Prevent duplicates
      const PREFIX_MAX_LENGTH = 9
      const duplicate = findOne(
        join(
          mediaPath(),
          item.folder,
          '*' +
            item.safeName?.substring(PREFIX_MAX_LENGTH).replace('.svg', '.png'),
        ),
      )
      if (
        duplicate &&
        item.safeName &&
        ((await stat(duplicate)).size === item.filesize ||
          extname(item.safeName) === '.svg')
      ) {
        if (basename(duplicate) !== item.safeName) {
          rename(
            duplicate,
            basename(duplicate),
            item.safeName.replace('.svg', '.png'),
          )
        }
        statStore.setDownloads({
          origin: 'cong',
          source: 'cache',
          file: item,
        })
      } else {
        const client = useCongStore().client
        if (client && item.url) {
          const perf: any = {
            start: performance.now(),
            bytes: item.filesize,
            name: item.safeName,
          }
          const file = (await client.getFileContents(item.url, {
            onDownloadProgress: (progress) => {
              if (setProgress) setProgress(progress.loaded, progress.total)
            },
          })) as ArrayBuffer

          perf.end = performance.now()
          perf.bits = perf.bytes * BITS_IN_BYTE
          perf.ms = perf.end - perf.start
          perf.s = perf.ms / MS_IN_SEC
          perf.bps = perf.bits / perf.s
          perf.MBps = perf.bps / BYTES_IN_MB
          perf.dir = 'down'
          log.debug('perf', perf)

          write(
            join(mediaPath(), item.folder, item.safeName),
            Buffer.from(new Uint8Array(file)),
          )
          statStore.setDownloads({
            origin: 'cong',
            source: 'live',
            file: item,
          })
        }
      }
    } else {
      warn('warnFileNotAvailable', {
        identifier: [
          item.queryInfo?.KeySymbol,
          item.queryInfo?.Track,
          item.queryInfo?.IssueTagNumber,
        ]
          .filter(Boolean)
          .join('_'),
      })
    }
  }
  if (setProgress) increaseProgress(setProgress)
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

export async function renameCongFile(
  file: CongFile,
  oldLocale: LocaleObject,
  newLocale: LocaleObject,
): Promise<void> {
  const store = useCongStore()
  if (!store.client) return
  const oldVal = oldLocale.code
  const newVal = newLocale.code
  if (file.basename.includes(' - ' + translate('song', oldVal))) {
    const newName = file.filename.replace(
      ' - ' + translate('song', oldVal),
      ' - ' + translate('song', newVal),
    )

    if (file.filename !== newName) {
      await store.client.moveFile(file.filename, newName)
    }
  } else if (file.basename.includes(' - ' + translate('paragraph', oldVal))) {
    const newName = file.filename.replace(
      ' - ' + translate('paragraph', oldVal),
      ' - ' + translate('paragraph', newVal),
    )
    if (file.filename !== newName) {
      await store.client.moveFile(file.filename, newName)
    }
  } else if (file.type === 'directory') {
    const dateFormat = getPrefs<DateFormat>('app.outputFolderDateFormat')
    const date = useNuxtApp().$dayjs(
      file.basename,
      dateFormat,
      oldLocale.dayjs ?? oldVal,
    )

    if (date.isValid()) {
      const newName = file.filename.replace(
        file.basename,
        date.locale(newVal).format(dateFormat),
      )
      if (file.filename !== newName) {
        if (!store.contents.find(({ filename }) => filename === newName)) {
          await store.client.moveFile(file.filename, newName)
        }
      }
    }
  }
}
