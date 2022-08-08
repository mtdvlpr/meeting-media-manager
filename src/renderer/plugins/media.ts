import { pathToFileURL } from 'url'
/* eslint-disable import/named */
import { Dayjs } from 'dayjs'
import { Context } from '@nuxt/types'
import { emptyDirSync, existsSync, readFileSync, statSync } from 'fs-extra'
import { NuxtAxiosInstance } from '@nuxtjs/axios'
import { basename, changeExt, extname, join, resolve } from 'upath'
import { Database } from 'sql.js'
import {
  MediaFile,
  MediaItemResult,
  MultiMediaExtract,
  MultiMediaImage,
  MultiMediaItem,
  Publication,
  ShortJWLang,
  SmallMediaFile,
  MultiMediaExtractRef,
} from '~/types'

export default function (
  {
    $pubPath,
    $pubMedia,
    $findAll,
    $log,
    $warn,
    $mediaPath,
    $axios,
    $rename,
    $setDb,
    $copy,
    $extractAllTo,
    $getPrefs,
    $mediaItems,
    i18n,
    $write,
    $findOne,
    $error,
    $getLocalJWLangs,
    $getDb,
    $getZipContentsByExt,
    $isVideo,
    $isImage,
    $query,
    $dayjs,
    $sanitize,
    store,
  }: Context,
  inject: (argument0: string, argument1: unknown) => void
) {
  async function getDocumentExtract(
    db: Database,
    docId: number,
    setProgress?: Function
  ) {
    const excludeTh = $getPrefs('media.excludeTh')
    let extractMultimediaItems: (SmallMediaFile | MultiMediaImage)[] = []
    const extracts = $query(
      db,
      `SELECT DocumentExtract.BeginParagraphOrdinal,DocumentExtract.EndParagraphOrdinal,DocumentExtract.DocumentId,
        Extract.RefMepsDocumentId,Extract.RefPublicationId,Extract.RefMepsDocumentId,UniqueEnglishSymbol,IssueTagNumber,
        Extract.RefBeginParagraphOrdinal,Extract.RefEndParagraphOrdinal, Extract.Link
      FROM DocumentExtract
        INNER JOIN Extract ON DocumentExtract.ExtractId = Extract.ExtractId
        INNER JOIN RefPublication ON Extract.RefPublicationId = RefPublication.RefPublicationId
        INNER JOIN Document ON DocumentExtract.DocumentId = Document.DocumentId
      WHERE DocumentExtract.DocumentId = ${docId}
        AND NOT UniqueEnglishSymbol = 'sjj'
        AND NOT UniqueEnglishSymbol = 'mwbr'
        ${excludeTh ? "AND NOT UniqueEnglishSymbol = 'th' " : ''}
      ORDER BY DocumentExtract.BeginParagraphOrdinal`
    ) as MultiMediaExtract[]
    for (const extract of extracts) {
      extract.Lang = $getPrefs('media.lang') as string
      if (extract.Link) {
        try {
          const matches = extract.Link.match(/\/(.*)\//)
          if (matches && matches.length > 0) {
            extract.Lang = (matches.pop() as string).split(':')[0]
          }
        } catch (e) {
          $log.error(e)
        }
      }

      const symbol = extract.UniqueEnglishSymbol.replace(/[0-9]/g, '')

      // exclude the "old new songs" songbook, as we don't need images from that
      if (symbol !== 'snnw') {
        const extractDb = await getDbFromJWPUB(
          symbol,
          extract.IssueTagNumber,
          setProgress
        )
        if (extractDb) {
          extractMultimediaItems = extractMultimediaItems.concat(
            (
              await getDocumentMultiMedia(
                extractDb,
                null,
                extract.RefMepsDocumentId
              )
            )
              .filter((mmItem) => {
                if (
                  mmItem?.queryInfo?.tableQuestionIsUsed &&
                  !mmItem?.queryInfo?.TargetParagraphNumberLabel
                ) {
                  mmItem.BeginParagraphOrdinal =
                    mmItem.queryInfo.NextParagraphOrdinal
                }

                // include videos with no specific paragraph for sign language, as they are sometimes used (ie the CBS chapter video)
                if (
                  (
                    $getLocalJWLangs().find(
                      (lang) => lang.langcode === $getPrefs('media.lang')
                    ) as ShortJWLang
                  ).isSignLanguage &&
                  !!mmItem?.queryInfo?.FilePath &&
                  $isVideo(mmItem?.queryInfo?.FilePath) &&
                  !mmItem?.queryInfo?.TargetParagraphNumberLabel
                ) {
                  return true
                } else if (
                  mmItem.BeginParagraphOrdinal &&
                  extract.RefBeginParagraphOrdinal &&
                  extract.RefEndParagraphOrdinal
                ) {
                  return (
                    extract.RefBeginParagraphOrdinal <=
                      mmItem.BeginParagraphOrdinal &&
                    mmItem.BeginParagraphOrdinal <=
                      extract.RefEndParagraphOrdinal
                  )
                } else {
                  return true
                }
              })
              .map((mmItem) => {
                mmItem.BeginParagraphOrdinal = extract.BeginParagraphOrdinal
                return mmItem
              })
          )
        }
      }
    }
    return extractMultimediaItems
  }

  async function addMediaItemToPart(
    date: string,
    par: number,
    media: SmallMediaFile | MultiMediaImage,
    source?: string
  ) {
    const mediaList = (await store.dispatch('media/get', {
      date,
      par,
    })) as (SmallMediaFile | MultiMediaImage)[]

    media.uniqueId = [par, source, media.checksum, media.filepath]
      .filter(Boolean)
      .toString()

    if (
      !media.uniqueId ||
      !mediaList
        .flat()
        .map((item) => item.uniqueId)
        .filter(Boolean)
        .includes(media.uniqueId)
    ) {
      media.folder = date
      store.commit('media/set', {
        date,
        par,
        media,
      })
    }
  }

  async function getDocumentMultiMedia(
    db: Database,
    docId: number | null,
    mepsId?: number,
    memOnly: boolean = false
  ) {
    const result = $query(
      db,
      "SELECT * FROM sqlite_master WHERE type='table' AND name='DocumentMultimedia'"
    )

    const mmTable = result.length === 0 ? 'Multimedia' : 'DocumentMultimedia'

    const keySymbol = (
      $query(db, 'SELECT UniqueEnglishSymbol FROM Publication') as {
        UniqueEnglishSymbol: string
      }[]
    )[0].UniqueEnglishSymbol.replace(/[0-9]*/g, '') as string

    const issueTagNumber = (
      $query(db, 'SELECT IssueTagNumber FROM Publication') as {
        IssueTagNumber: string
      }[]
    )[0].IssueTagNumber

    const targetParNrExists = (
      $query(db, "PRAGMA table_info('Question')") as { name: string }[]
    )
      .map((item) => item.name)
      .includes('TargetParagraphNumberLabel')

    const suppressZoomExists = (
      $query(db, "PRAGMA table_info('Multimedia')") as { name: string }[]
    )
      .map((item) => item.name)
      .includes('SuppressZoom') as boolean

    const mmItems: (SmallMediaFile | MultiMediaImage)[] = []

    const excludeLffi = $getPrefs('media.excludeLffi')
    const excludeLffiImages = $getPrefs('media.excludeLffiImages')

    if (!(keySymbol === 'lffi' && excludeLffi && excludeLffiImages)) {
      let select = `SELECT ${mmTable}.DocumentId, ${mmTable}.MultimediaId, Multimedia.MimeType, Multimedia.DataType, Multimedia.MajorType, Multimedia.FilePath, Multimedia.Label, Multimedia.Caption, Multimedia.CategoryType`
      let from = `FROM ${mmTable} INNER JOIN Document ON ${mmTable}.DocumentId = Document.DocumentId`
      let where = `WHERE ${
        docId || docId === 0
          ? `${mmTable}.DocumentId = ${docId}`
          : `Document.MepsDocumentId = ${mepsId}`
      }`
      let groupAndSort = ''

      if (mmTable === 'DocumentMultimedia') {
        select += `, ${mmTable}.BeginParagraphOrdinal, ${mmTable}.EndParagraphOrdinal, Multimedia.KeySymbol, Multimedia.MepsDocumentId AS MultiMeps, Document.MepsDocumentId, Multimedia.Track, Multimedia.IssueTagNumber`
        from += ` INNER JOIN Multimedia ON Multimedia.MultimediaId = ${mmTable}.MultimediaId`
        groupAndSort = `GROUP BY ${mmTable}.MultimediaId ORDER BY BeginParagraphOrdinal`

        if (targetParNrExists) {
          select += `, Question.TargetParagraphNumberLabel`
          from += ` LEFT JOIN Question ON Question.DocumentId = ${mmTable}.DocumentId AND Question.TargetParagraphOrdinal = ${mmTable}.BeginParagraphOrdinal`
        }
      }

      if (suppressZoomExists) {
        select += `, Multimedia.SuppressZoom`
        where += ` AND Multimedia.SuppressZoom <> 1`
      }

      const lffiString = `(Multimedia.MimeType LIKE '%video%' OR Multimedia.MimeType LIKE '%audio%')`
      const lffiImgString = `(Multimedia.MimeType LIKE '%image%' AND Multimedia.CategoryType <> 6 AND Multimedia.CategoryType <> 9 AND Multimedia.CategoryType <> 10 AND Multimedia.CategoryType <> 25)`

      if (keySymbol !== 'lffi')
        where += ` AND (${lffiString} OR ${lffiImgString})`
      if (keySymbol === 'lffi') {
        if (!excludeLffi && !excludeLffiImages) {
          where += ` AND (${lffiString} OR ${lffiImgString})`
        } else if (!excludeLffi) {
          where += ` AND ${lffiString}`
        } else if (!excludeLffiImages) {
          where += ` AND ${lffiImgString}`
        }
      }

      for (const mmItem of $query(
        db,
        `${select} ${from} ${where} ${groupAndSort}`
      ) as MultiMediaItem[]) {
        if (targetParNrExists) {
          const result = $query(
            db,
            `SELECT TargetParagraphNumberLabel From Question WHERE DocumentId = ${mmItem.DocumentId} AND TargetParagraphOrdinal = ${mmItem.BeginParagraphOrdinal}`
          )
          if (result.length === 1) Object.assign(mmItem, result[0])
          if (
            (
              $query(db, 'SELECT COUNT(*) as Count FROM Question') as {
                Count: number
              }[]
            )[0].Count > 0
          ) {
            mmItem.tableQuestionIsUsed = true
            const result = $query(
              db,
              `SELECT TargetParagraphNumberLabel, TargetParagraphOrdinal From Question WHERE DocumentId = ${mmItem.DocumentId} AND TargetParagraphOrdinal > ${mmItem.BeginParagraphOrdinal} LIMIT 1`
            ) as {
              TargetParagraphNumberLabel: string
              TargetParagraphOrdinal: number
            }[]
            if (result.length > 0)
              mmItem.NextParagraphOrdinal = result[0].TargetParagraphOrdinal
          }
        }
        try {
          if (
            mmItem.MimeType.includes('audio') ||
            mmItem.MimeType.includes('video')
          ) {
            const json =
              (
                await getMediaLinks({
                  pubSymbol: mmItem.KeySymbol as string,
                  track: mmItem.Track as number,
                  issue: (mmItem.IssueTagNumber as number)?.toString(),
                  docId: mmItem.MultiMeps as number,
                })
              )[0] ?? {}
            json.queryInfo = mmItem
            json.BeginParagraphOrdinal = mmItem.BeginParagraphOrdinal
            mmItems.push(json)
          } else {
            if (!mmItem.KeySymbol) {
              mmItem.KeySymbol = keySymbol
              mmItem.IssueTagNumber = +issueTagNumber
              if (!memOnly) {
                mmItem.LocalPath = join(
                  $pubPath(),
                  mmItem.KeySymbol as string,
                  mmItem.IssueTagNumber.toString(),
                  '0',
                  mmItem.FilePath
                )
              }
            }
            mmItem.FileName = $sanitize(
              mmItem.Caption.length > mmItem.Label.length
                ? mmItem.Caption
                : mmItem.Label
            )
            const picture = {
              BeginParagraphOrdinal: mmItem.BeginParagraphOrdinal,
              title: mmItem.FileName,
              queryInfo: mmItem,
              filepath: memOnly ? undefined : mmItem.LocalPath,
              filesize: memOnly
                ? undefined
                : statSync(mmItem.LocalPath as string).size,
            } as MultiMediaImage

            mmItems.push(picture)
          }
        } catch (e) {
          $log.error(`${keySymbol}-${issueTagNumber}`, e)
          $warn(i18n.t('errorJwpubMediaExtract') as string)
        }
      }
    }
    return mmItems
  }
  inject('getDocumentMultiMedia', getDocumentMultiMedia)

  async function getMediaLinks(mediaItem: {
    docId?: number
    track?: number
    pubSymbol: string
    issue?: string
    format?: string
    lang?: string
  }) {
    let mediaFiles: MediaFile[] = []
    let smallMediaFiles: SmallMediaFile[] = []

    try {
      // From 2008 onward the watchtower has a public and study release
      if (
        mediaItem.pubSymbol === 'w' &&
        mediaItem.issue &&
        parseInt(mediaItem.issue) >= 20080101 &&
        mediaItem.issue.toString().slice(-2) === '01'
      ) {
        mediaItem.pubSymbol = 'wp'
      }

      if (mediaItem.pubSymbol === 'sjjm') {
        mediaItem.pubSymbol = store.state.media.songPub
      }

      const mediaLang = mediaItem.lang || $getPrefs('media.lang')

      // Get publication from jw api
      let result = null
      try {
        result = await $pubMedia.get('', {
          params: {
            pub: mediaItem.pubSymbol,
            track: mediaItem.track,
            issue: mediaItem.issue,
            fileformat: mediaItem.format,
            docid: mediaItem.docId,
            langwritten: mediaLang,
          },
        })
      } catch (e) {
        try {
          result = await $pubMedia.get('', {
            params: {
              pub: mediaItem.pubSymbol + 'm',
              track: mediaItem.track,
              issue: mediaItem.issue,
              fileformat: mediaItem.format,
              langwritten: mediaLang,
            },
          })
        } catch (e) {
          result = await $pubMedia.get('', {
            params: {
              pub: mediaItem.pubSymbol.slice(0, -1),
              track: mediaItem.track,
              issue: mediaItem.issue,
              fileformat: mediaItem.format,
              langwritten: mediaLang,
            },
          })
        }
      }
      $log.debug(result?.request.responseURL, mediaItem)

      const publication = result?.data as Publication
      const categories = Object.values(publication.files)[0]
      mediaFiles = categories.MP4 ?? Object.values(categories)[0]

      // Filter on max resolution
      mediaFiles = mediaFiles.filter((file) => {
        return (
          parseRes(file.label) <= parseRes($getPrefs('media.maxRes') as string)
        )
      })

      const mappedFiles = new Map(mediaFiles.map((file) => [file.title, file]))

      // Keep highest resolution of each media file without subtitles
      mediaFiles.forEach((item) => {
        const file = mappedFiles.get(item.title)
        if (file) {
          const { label, subtitled } = file
          if (
            (parseRes(item.label) - parseRes(label) ||
              +!!subtitled - +!!item.subtitled) > 0
          )
            mappedFiles.set(item.title, item)
        }
      })

      smallMediaFiles = Array.from(mappedFiles.values()).map(
        ({
          title,
          file,
          filesize,
          duration,
          trackImage,
          track,
          pub,
          markers,
        }) => {
          return {
            title,
            issue: mediaItem.issue,
            url: file?.url,
            checksum: file?.checksum,
            filesize,
            duration,
            trackImage: trackImage.url,
            track,
            pub,
            markers,
          }
        }
      ) as SmallMediaFile[]

      // Get thumbnail and primaryCategory
      for (const item of smallMediaFiles) {
        if ((item.duration as number) > 0 && (!item.trackImage || !item.pub)) {
          const id = mediaItem.docId
            ? `docid-${mediaItem.docId}_1`
            : `pub-${[
                mediaItem.pubSymbol,
                mediaItem.issue?.toString().replace(/(\d{6})00$/gm, '$1'),
                mediaItem.track,
              ]
                .filter(Boolean)
                .join('_')}`
          const result = (await $mediaItems.$get(
            `${$getPrefs('media.lang')}/${id}_VIDEO`
          )) as MediaItemResult

          if (result?.media?.length > 0) {
            item.thumbnail = result?.media[0]?.images?.wss?.sm
            item.primaryCategory = result?.media[0]?.primaryCategory
          }
        }
      }
    } catch (e) {
      $log.error(e)
      $warn(i18n.t('infoPubIgnored') as string)
    }
    $log.debug(smallMediaFiles)
    return smallMediaFiles
  }
  inject('getMediaLinks', getMediaLinks)

  function parseRes(res?: string): number {
    if (!res) return 0
    return +res.replace(/\D/g, '')
  }

  async function getDbFromJWPUB(
    pub?: string,
    issue?: string,
    setProgress?: Function,
    localPath: string = ''
  ) {
    let db: Database
    try {
      if (localPath) {
        db = await $getDb({
          pub,
          issue,
          file: $getZipContentsByExt(localPath, '.db'),
        })

        try {
          const jwpubInfo: {
            UniqueEnglishSymbol: string
            IssueTagNumber: string
          } = (
            $query(
              db,
              'SELECT UniqueEnglishSymbol, IssueTagNumber FROM Publication'
            ) as { UniqueEnglishSymbol: string; IssueTagNumber: string }[]
          )[0]
          pub = jwpubInfo.UniqueEnglishSymbol.replace(/[0-9]/g, '')
          issue = jwpubInfo.IssueTagNumber
          $setDb(pub, issue, db)
        } catch (e) {
          $log.error(e)
        }
      } else if (pub) {
        const jwpub = (
          await getMediaLinks({
            pubSymbol: pub,
            issue,
            format: 'JWPUB',
          })
        )[0]
        await downloadIfRequired(jwpub, setProgress)
        db = await $getDb({
          pub,
          issue,
          file: readFileSync($findOne(join($pubPath(jwpub), '*.db'))),
        })
      } else return null
    } catch (e) {
      $log.error(`${pub}-${issue}`, e)
      $warn(i18n.t('errorJwpubDbFetch') as string)
      return null
    }
    return db
  }

  inject('getDbFromJWPUB', getDbFromJWPUB)

  async function downloadIfRequired(
    file: SmallMediaFile,
    setProgress?: Function
  ) {
    file.downloadRequired = true
    file.cacheDir = $pubPath(file) as string
    file.cacheFilename = basename(file.url) || file.safeName
    file.cacheFile = join(file.cacheDir, file.cacheFilename as string)
    file.destFilename = file.folder ? file.safeName : file.cacheFilename
    if (existsSync(file.cacheFile)) {
      file.downloadRequired = file.filesize !== statSync(file.cacheFile).size
    }
    if (file.downloadRequired) {
      if (extname(file.cacheFile) === '.jwpub') {
        emptyDirSync(file.cacheDir)
      }
      const downloadedFile = Buffer.from(
        new Uint8Array(
          await ($axios as NuxtAxiosInstance).$get(file.url, {
            responseType: 'arraybuffer',
            onDownloadProgress: (progressEvent) => {
              if (setProgress) {
                setProgress(progressEvent.loaded, progressEvent.total)
              }
            },
          })
        )
      )
      $write(file.cacheFile, downloadedFile)
      if (file.folder) {
        $write($mediaPath(file), downloadedFile)
      }
      store.commit('stats/setDownloads', {
        origin: 'jworg',
        source: 'live',
        file,
      })
      if (extname(file.cacheFile) === '.jwpub') {
        $extractAllTo(file.cacheFile, 'contents', file.cacheDir)
      }
    } else {
      if (file.folder) {
        $copy(file.cacheFile, $mediaPath(file))
      }
      store.commit('stats/setDownloads', {
        origin: 'jworg',
        source: 'cache',
        file,
      })
    }
    return file.cacheFile
  }

  inject('downloadIfRequired', downloadIfRequired)

  inject('getMwMedia', async (date: string, setProgress?: Function) => {
    const mwDay = $dayjs(
      date,
      $getPrefs('app.outputFolderDateFormat') as string
    )
    const baseDate = mwDay.startOf('week')

    let issue = baseDate.format('YYYYMM') + '00'
    if (parseInt(baseDate.format('M')) % 2 === 0) {
      issue = baseDate.subtract(1, 'month').format('YYYYMM') + '00'
    }

    // Get document id of this weeks mwb issue
    const db = (await getDbFromJWPUB('mwb', issue, setProgress)) as Database
    const docId = (
      $query(
        db,
        `SELECT DocumentId FROM DatedText WHERE FirstDateOffset = ${baseDate.format(
          'YYYYMMDD'
        )}`
      ) as { DocumentId: number }[]
    )[0].DocumentId

    // Get document multimedia and add them to the media list
    const mms = await getDocumentMultiMedia(db, docId)
    for (const mm of mms) {
      await addMediaItemToPart(
        date,
        mm.BeginParagraphOrdinal as number,
        mm,
        'internal'
      )
    }

    // Get document extracts and add them to the media list
    const extracts = await getDocumentExtract(db, docId, setProgress)
    for (const extract of extracts) {
      await addMediaItemToPart(
        date,
        extract.BeginParagraphOrdinal as number,
        extract,
        'external'
      )
    }

    // Get document multimedia of internal references
    const internalRefs = $query(
      db,
      `SELECT DocumentInternalLink.DocumentId AS SourceDocumentId, DocumentInternalLink.BeginParagraphOrdinal, Document.DocumentId FROM DocumentInternalLink INNER JOIN InternalLink ON DocumentInternalLink.InternalLinkId = InternalLink.InternalLinkId INNER JOIN Document ON InternalLink.MepsDocumentId = Document.MepsDocumentId WHERE DocumentInternalLink.DocumentId = ${docId} AND Document.Class <> 94`
    ) as MultiMediaExtractRef[]

    for (const ref of internalRefs) {
      const refMedia = await getDocumentMultiMedia(db, ref.DocumentId)

      for (const refMediaFile of refMedia) {
        await addMediaItemToPart(
          date,
          ref.BeginParagraphOrdinal,
          refMediaFile,
          'internal'
        )
      }
    }
  })

  inject('getWeMedia', async (date: string, setProgress?: Function) => {
    const weDay = $dayjs(
      date,
      $getPrefs('app.outputFolderDateFormat') as string
    )
    const baseDate = weDay.startOf('week')

    const getWeekNr = (database: Database) => {
      return $query(
        database,
        'SELECT FirstDateOffset FROM DatedText'
      ).findIndex((weekItem: any) => {
        return $dayjs(
          weekItem.FirstDateOffset.toString(),
          'YYYYMMDD'
        ).isBetween(baseDate, baseDate.add(6, 'days'), null, '[]')
      })
    }

    let issue = baseDate.subtract(8, 'weeks').format('YYYYMM') + '00'
    let db = (await getDbFromJWPUB('w', issue, setProgress)) as Database
    let weekNr = getWeekNr(db)

    if (weekNr < 0) {
      issue = baseDate.subtract(9, 'weeks').format('YYYYMM') + '00'
      db = (await getDbFromJWPUB('w', issue, setProgress)) as Database
      weekNr = getWeekNr(db)
    }
    if (weekNr < 0) throw new Error('No WE meeting data found!')

    const docId = (
      $query(
        db,
        `SELECT Document.DocumentId FROM Document WHERE Document.Class=40 LIMIT 1 OFFSET ${weekNr}`
      ) as { DocumentId: number }[]
    )[0].DocumentId

    const images = $query(
      db,
      `SELECT DocumentMultimedia.MultimediaId,Document.DocumentId, Multimedia.CategoryType,Multimedia.KeySymbol,Multimedia.Track,Multimedia.IssueTagNumber,Multimedia.MimeType, DocumentMultimedia.BeginParagraphOrdinal,Multimedia.FilePath,Label,Caption, Question.TargetParagraphNumberLabel
    FROM DocumentMultimedia
      INNER JOIN Document ON Document.DocumentId = DocumentMultimedia.DocumentId
      INNER JOIN Multimedia ON DocumentMultimedia.MultimediaId = Multimedia.MultimediaId
      LEFT JOIN Question ON Question.DocumentId = DocumentMultimedia.DocumentId AND Question.TargetParagraphOrdinal = DocumentMultimedia.BeginParagraphOrdinal
    WHERE Document.DocumentId = ${docId} AND Multimedia.CategoryType <> 9 GROUP BY DocumentMultimedia.MultimediaId`
    ) as MultiMediaItem[]

    for (const img of images) {
      if ($isImage(img.FilePath)) {
        const LocalPath = join($pubPath(), 'w', issue, '0', img.FilePath)
        const FileName = $sanitize(
          img.Caption.length > img.Label.length ? img.Caption : img.Label
        )
        const pictureObj = {
          title: FileName,
          filepath: LocalPath,
          filesize: statSync(LocalPath).size,
          queryInfo: img,
        } as MultiMediaImage
        await addMediaItemToPart(date, 1, pictureObj)
      } else {
        const media = await getMediaLinks({
          pubSymbol: img.KeySymbol ?? '',
          track: img.Track as number,
          issue: img.IssueTagNumber?.toString(),
        })
        if (media?.length > 0) addMediaItemToPart(date, 1, media[0])
      }
    }

    const songs = $query(
      db,
      `SELECT * FROM Multimedia INNER JOIN DocumentMultimedia ON Multimedia.MultimediaId = DocumentMultimedia.MultimediaId WHERE DataType = 2 ORDER BY BeginParagraphOrdinal LIMIT 2 OFFSET ${
        2 * weekNr
      }`
    ) as MultiMediaItem[]

    for (const [i, song] of songs.entries()) {
      const songMedia = await getMediaLinks({
        pubSymbol: song.KeySymbol as string,
        track: song.Track as number,
      })
      if (songMedia?.length > 0) {
        const songObj = songMedia[0]
        songObj.queryInfo = song
        await addMediaItemToPart(date, 2 * i, songObj)
      } else {
        $error(i18n.t('errorGetWeMedia') as string)
      }
    }
  })

  inject('createMediaNames', () => {
    store.commit('stats/startPerf', {
      func: 'createMediaNames',
      start: performance.now(),
    })
    const meetings = store.getters['media/meetings'] as Map<
      string,
      Map<number, (SmallMediaFile | MultiMediaImage)[]>
    >
    for (const [, parts] of meetings.entries()) {
      let i = 1
      for (const [, media] of [...parts.entries()].sort(
        (a, b) => a[0] - b[0]
      )) {
        media
          .filter((m) => !m.safeName)
          .forEach((item, j) => {
            item.safeName = `${i.toString().padStart(2, '0')}-${(j + 1)
              .toString()
              .padStart(2, '0')} -`
            if (!item.congSpecific) {
              if (item.queryInfo?.TargetParagraphNumberLabel) {
                item.safeName += ` ${i18n.t('paragraph')} ${
                  item.queryInfo?.TargetParagraphNumberLabel
                } -`
              }
              if (item.pub?.includes('sjj')) {
                item.safeName += ` ${i18n.t('song')}`
              }
              item.safeName = $sanitize(
                `${item.safeName} ${item.title}${extname(
                  item.url || item.filepath || ''
                )}`,
                true
              )
            }
          })
        i++
      }
    }
    $log.debug(meetings)
    /* log.debug(Object.entries(get("meetingMedia")).map(meeting => { meeting[1] = meeting[1]
    .filter(mediaItem => mediaItem.media.length > 0)
    .map(item => item.media)
    .flat(); return meeting;
  })) */
    store.commit('stats/stopPerf', {
      func: 'createMediaNames',
      stop: performance.now(),
    })
  })

  inject('syncLocalRecurringMedia', (baseDate: Dayjs) => {
    const meetings = store.getters['media/meetings'] as Map<
      string,
      Map<number, (SmallMediaFile | MultiMediaImage)[]>
    >
    const dates = [...meetings.keys()].filter((date) => {
      if (date === 'Recurring') return false
      const day = $dayjs(
        date,
        $getPrefs('app.outputFolderDateFormat') as string
      )
      return (
        day.isValid() &&
        day.isBetween(baseDate, baseDate.add(6, 'days'), null, '[]')
      )
    })
    $findAll(join($mediaPath(), 'Recurring', '*')).forEach(
      (recurringItem: string) => {
        dates.forEach((date) => {
          $copy(
            recurringItem,
            join($mediaPath(), date, basename(recurringItem))
          )
        })
      }
    )
  })

  inject(
    'syncJWMedia',
    async (dryrun: boolean, baseDate: Dayjs, setProgress: Function) => {
      const meetings = new Map(
        Array.from(
          store.getters['media/meetings'] as Map<
            string,
            Map<number, (SmallMediaFile | MultiMediaImage)[]>
          >
        )
          .filter(([date, _parts]) => {
            if (date === 'Recurring') return false
            const dateObj = $dayjs(
              date,
              $getPrefs('app.outputFolderDateFormat') as string
            )
            return (
              dateObj.isValid() &&
              dateObj.isBetween(baseDate, baseDate.add(6, 'days'), null, '[]')
            )
          })
          .map((meeting) => {
            meeting[1] = new Map(
              Array.from(meeting[1]).filter((part) => {
                part[1] = part[1].filter((mediaItem) => !mediaItem.congSpecific)
                return part
              })
            )
            return meeting
          })
      )

      let total = 0
      meetings.forEach((parts) =>
        parts.forEach((media) => (total += media.length))
      )

      let progress = 0
      for (const [date, parts] of meetings.entries()) {
        for (const [, media] of parts.entries()) {
          for (const item of media) {
            if (!dryrun && !item.hidden && !item.isLocal) {
              if (item.filesize) {
                $log.info(
                  `%c[jwOrg] [${date}] ${item.safeName}`,
                  'background-color: #cce5ff; color: #004085;'
                )
                if (item.markers) {
                  const markers = item.markers.markers
                  // ? Why this? Some sort of way to remove duplicates?
                  // markers = Array.from(new Set(markers.map(JSON.stringify))).map(JSON.parse)

                  $write(
                    join(
                      $mediaPath(),
                      item.folder as string,
                      changeExt(item.safeName as string, 'json')
                    ),
                    JSON.stringify(markers)
                  )
                }

                const duplicate = $findOne(
                  join(
                    $mediaPath(),
                    item.folder as string,
                    '*' + item.safeName?.substring(8).replace('.svg', '.png')
                  )
                )

                if (
                  duplicate &&
                  basename(duplicate) !== item.safeName &&
                  (statSync(duplicate).size === item.filesize ||
                    extname(item.safeName as string) === '.svg')
                ) {
                  $rename(
                    duplicate,
                    basename(duplicate),
                    (item.safeName as string).replace('.svg', '.png')
                  )
                } else if (item.url) {
                  await downloadIfRequired(
                    JSON.parse(JSON.stringify(item as SmallMediaFile)),
                    setProgress
                  )
                } else {
                  const dest = join(
                    $mediaPath(),
                    item.folder as string,
                    item.safeName as string
                  )
                  if (
                    !existsSync(dest) ||
                    statSync(dest).size !== item.filesize
                  ) {
                    $copy(item.filepath as string, dest)
                  }
                }
              } else {
                $warn(i18n.t('warnFileNotAvailable') as string)
                $log.warn(
                  [
                    item.queryInfo?.KeySymbol,
                    item.queryInfo?.Track,
                    item.queryInfo?.IssueTagNumber,
                  ]
                    .filter(Boolean)
                    .join('_')
                )
              }
            }
            progress++
            setProgress(progress, total, true)
          }
        }
      }
    }
  )

  async function shuffleMusic(stop: boolean = false) {
    if (stop) {
      const audio = document.querySelector('#meetingMusic') as HTMLAudioElement
      /* const animation = audio.animate([{ volume: 0 }], {
        duration: 6000,
      })
      await animation.finished */
      audio.remove()
      store.commit('media/setMusicFadeOut', '')
    } else {
      if ($getPrefs('meeting.enableMusicFadeOut')) {
        const now = $dayjs()
        if ($getPrefs('meeting.musicFadeOutType') === 'smart') {
          const today = now.day() === 0 ? 6 : now.day() - 1 // day is 0 indexed and starts with Sunday
          if (
            today === $getPrefs('meeting.mwDay') ||
            today === $getPrefs('meeting.weDay')
          ) {
            let meetingStarts = null
            if (today === $getPrefs('meeting.mwDay')) {
              meetingStarts = (
                $getPrefs('meeting.mwStartTime') as string
              ).split(':')
            } else {
              meetingStarts = (
                $getPrefs('meeting.weStartTime') as string
              ).split(':')
            }
            const timeToStop = now
              .hour(+meetingStarts[0])
              .minute(+meetingStarts[1])
              .second(0)
              .millisecond(0)
              .subtract($getPrefs('meeting.musicFadeOutTime') as number, 's')
              .subtract(6, 's')

            if (timeToStop.isAfter(now)) {
              store.commit('media/setMusicFadeOut', timeToStop)
            }
          }
        } else {
          store.commit(
            'media/setMusicFadeOut',
            now.add($getPrefs('meeting.musicFadeOutTime') as number, 'm')
          )
        }
      }

      const songs = (
        store.state.stats.online
          ? (
              await getMediaLinks({
                pubSymbol: 'sjjm',
                format: 'MP3',
                lang: 'E',
              })
            ).filter((item) => extname(item.url) === '.mp3')
          : $findAll(
              join($pubPath(), store.state.media.songPub, '**', '*.mp3')
            ).map((item) => ({
              title: basename(item),
              track: basename(resolve(item, '..')),
              path: item,
            }))
      ).sort(() => 0.5 - Math.random())

      createAudioElement(songs, 0, !!store.state.media.musicFadeOut)
    }
  }

  inject('shuffleMusic', shuffleMusic)

  async function createAudioElement(
    songs: (SmallMediaFile | { title: string; track: string; path: string })[],
    index: number,
    fadeOut: boolean
  ) {
    const audio = document.createElement('audio')
    audio.autoplay = true
    audio.id = 'meetingMusic'
    audio.setAttribute('track', songs[index].track.toString())
    audio.onended = () => {
      audio.remove()
      createAudioElement(songs, index < songs.length - 1 ? ++index : 0, fadeOut)
    }
    audio.oncanplay = () => {
      audio.volume = ($getPrefs('meeting.musicVolume') as number) / 100
      if (!fadeOut) {
        store.commit('media/setMusicFadeOut', '00:00')
      }
    }
    audio.ontimeupdate = () => {
      const duration = $dayjs
        .duration(audio.duration - audio.currentTime, 's')
        .format('mm:ss')

      if (store.state.media.musicFadeOut && !fadeOut) {
        store.commit('media/setMusicFadeOut', duration)
      }
    }

    const source = document.createElement('source')
    source.type = 'audio/mpeg'
    if (store.state.stats.online) {
      source.src = pathToFileURL(
        await downloadIfRequired(songs[index] as SmallMediaFile)
      ).href
    } else {
      // @ts-ignore
      source.src = pathToFileURL(songs[index].path).href
    }
    audio.appendChild(source)
    document.body.appendChild(audio)
  }
}
