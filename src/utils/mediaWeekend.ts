import { FOOTNOTE_PAR_NR } from './../constants/general'
import { pathExists, stat } from 'fs-extra'
import { join } from 'upath'
import type { Database } from '@stephen/sql.js'
import type {
  MultiMediaItem,
  MeetingFile,
  DateFormat,
  ImageFile,
  VideoFile,
} from '~~/types'

export async function getWeMedia(date: string) {
  const dayjs = useDayjs()
  const weDay = dayjs(date, getPrefs<DateFormat>('app.outputFolderDateFormat'))
  const baseDate = weDay.startOf('week')

  // Get week nr from db
  const getWeekNr = (database: Database | null) => {
    if (!database) return -1
    return executeQuery(
      database,
      'SELECT FirstDateOffset FROM DatedText',
    ).findIndex((weekItem: any) => {
      return dayjs(weekItem.FirstDateOffset.toString(), 'YYYYMMDD').isBetween(
        baseDate,
        baseDate.add(6, 'days'),
        null,
        '[]',
      )
    })
  }

  let issue = baseDate.subtract(8, 'weeks').format('YYYYMM') + '00'
  let db = await getDbFromJWPUB({ pub: 'w', issue, date })
  let weekNr = getWeekNr(db)

  if (weekNr < 0) {
    issue = baseDate.subtract(10, 'weeks').format('YYYYMM') + '00'
    db = await getDbFromJWPUB({ pub: 'w', issue, date })
    weekNr = getWeekNr(db)
  }
  if (!db || weekNr < 0) {
    throw new Error(`No WE meeting data found for ${date}!`)
  }

  const docId = executeQuery<{ DocumentId: number }>(
    db,
    `SELECT Document.DocumentId FROM Document WHERE Document.Class=40 LIMIT 1 OFFSET ${weekNr}`,
  )[0]?.DocumentId

  // Return without error if no docId found (e.g. memorial week)
  if (!docId) return

  const magazine = executeQuery<{ Title: string }>(
    db,
    `SELECT Title FROM PublicationIssueProperty LIMIT 1`,
  )[0]
  const article = executeQuery<{ Title: string }>(
    db,
    `SELECT Title FROM Document WHERE DocumentId = ${docId}`,
  )[0]

  write(
    join(
      mediaPath(),
      date,
      strip(magazine.Title + ' - ' + article.Title, 'file') + '.title',
    ),
    '',
  )

  const promises: Promise<void>[] = []

  const videos = executeQuery<MultiMediaItem>(
    db,
    `SELECT DocumentMultimedia.MultimediaId, DocumentMultimedia.DocumentId, CategoryType, KeySymbol, Track, IssueTagNumber, MimeType, BeginParagraphOrdinal, TargetParagraphNumberLabel, MepsDocumentId
         FROM DocumentMultimedia
         INNER JOIN Multimedia
           ON DocumentMultimedia.MultimediaId = Multimedia.MultimediaId
         LEFT JOIN Question
           ON Question.DocumentId = DocumentMultimedia.DocumentId 
           AND Question.TargetParagraphOrdinal = DocumentMultimedia.BeginParagraphOrdinal
         WHERE DocumentMultimedia.DocumentId = ${docId}
           AND CategoryType = -1
         GROUP BY DocumentMultimedia.MultimediaId`,
  )
  const videosInParagraphs = videos.filter(
    (video) => !!video.TargetParagraphNumberLabel,
  )
  const videosNotInParagraphs = videos.filter(
    (video) => !video.TargetParagraphNumberLabel,
  )

  const excludeFootnotes = getPrefs<boolean>('media.excludeFootnotes')

  const media = executeQuery<MultiMediaItem>(
    db,
    `SELECT DocumentMultimedia.MultimediaId, DocumentMultimedia.DocumentId, CategoryType, MimeType, MepsDocumentId, BeginParagraphOrdinal, FilePath, Label, Caption, KeySymbol, Track, IssueTagNumber,
            COALESCE(
			        TargetParagraphNumberLabel,
              (
                SELECT Question.TargetParagraphNumberLabel
                FROM DocumentInternalLink
                INNER JOIN InternalLink ON DocumentInternalLink.InternalLinkId = InternalLink.InternalLinkId
                INNER JOIN Question ON Question.DocumentId = DocumentInternalLink.DocumentId
                  AND Question.ParagraphOrdinal = DocumentInternalLink.BeginParagraphOrdinal
                WHERE DocumentInternalLink.DocumentId = DocumentMultimedia.DocumentId
                  AND DocumentMultimedia.BeginParagraphOrdinal BETWEEN InternalLink.BeginParagraphOrdinal AND InternalLink.EndParagraphOrdinal
              ),
      				(
                SELECT DocumentParagraph.ParagraphNumberLabel
                FROM DocumentInternalLink
                INNER JOIN InternalLink ON DocumentInternalLink.InternalLinkId = InternalLink.InternalLinkId
                INNER JOIN DocumentMultimedia ON DocumentMultimedia.DocumentId = DocumentInternalLink.DocumentId
                INNER JOIN DocumentParagraph ON DocumentParagraph.ParagraphIndex = DocumentInternalLink.BeginParagraphOrdinal
                WHERE DocumentParagraph.DocumentId = DocumentMultimedia.DocumentId
                  AND DocumentMultimedia.BeginParagraphOrdinal BETWEEN InternalLink.BeginParagraphOrdinal AND InternalLink.EndParagraphOrdinal
              ) 
            ) AS TargetParagraphNumberLabel
         FROM DocumentMultimedia
         INNER JOIN Multimedia
           ON DocumentMultimedia.MultimediaId = Multimedia.MultimediaId
         LEFT JOIN Question
           ON Question.DocumentId = DocumentMultimedia.DocumentId 
           AND Question.TargetParagraphOrdinal = DocumentMultimedia.BeginParagraphOrdinal
         WHERE DocumentMultimedia.DocumentId = ${docId}
           AND CategoryType <> 9 
           AND CategoryType <> -1
           AND (KeySymbol != "sjjm" OR KeySymbol IS NULL)
         GROUP BY DocumentMultimedia.MultimediaId
         ORDER BY TargetParagraphNumberLabel`, // pictures
  )
    .concat(videosInParagraphs)
    .concat(
      // exclude the first two videos if wt is after FEB_2023, since these are the songs
      videosNotInParagraphs
        .slice(+issue < FEB_2023 ? 0 : 2)
        // assign special number so we know videos are referenced by a footnote
        .map((mediaObj) =>
          mediaObj.TargetParagraphNumberLabel === null
            ? { ...mediaObj, TargetParagraphNumberLabel: FOOTNOTE_PAR_NR }
            : mediaObj,
        )
        .filter((v) => {
          return (
            !excludeFootnotes || v.TargetParagraphNumberLabel! < FOOTNOTE_PAR_NR
          )
        }),
    )

  media.forEach((m) => promises.push(addMediaToPart(date, issue, m)))

  let songs = []

  // Watchtowers before Feb 2023 don't include songs in DocumentMultimedia
  if (+issue < FEB_2023) {
    songs = executeQuery(
      db,
      `SELECT *
          FROM Multimedia
          INNER JOIN DocumentMultimedia
            ON Multimedia.MultimediaId = DocumentMultimedia.MultimediaId
          WHERE DataType = 2
          ORDER BY BeginParagraphOrdinal
          LIMIT 2 OFFSET ${2 * weekNr}`,
    ) as MultiMediaItem[]
  } else {
    songs = videosNotInParagraphs.slice(0, 2) // after FEB_2023, the first two videos from DocumentMultimedia are the songs
  }

  let songLangs = songs.map(() => getPrefs<string>('media.lang'))

  try {
    songLangs = executeQuery<{
      Link: string
      ExtractId: number
      BeginParagraphOrdinal: number
    }>(
      db,
      `SELECT Extract.ExtractId, Extract.Link, DocumentExtract.BeginParagraphOrdinal FROM Extract INNER JOIN DocumentExtract ON Extract.ExtractId = DocumentExtract.ExtractId WHERE Extract.RefMepsDocumentClass = 31 ORDER BY Extract.ExtractId LIMIT 2 OFFSET ${
        2 * weekNr
      }`,
    )
      .sort((a, b) => a.BeginParagraphOrdinal - b.BeginParagraphOrdinal)
      .map((item) => {
        const match = item.Link.match(/\/(.*)\//)
        if (match) {
          return match.pop()?.split(':')[0] ?? getPrefs<string>('media.lang')
        } else {
          return getPrefs<string>('media.lang')
        }
      })
  } catch (e) {
    log.error(e)
  }

  songs.forEach((song, i) => {
    if (!(isCoWeek(baseDate) && i > 0)) {
      promises.push(addSongToPart(date, songLangs, song, i))
    }
  })

  await Promise.allSettled(promises)
}

async function addMediaToPart(
  date: string,
  issue: string,
  mediaItem: MultiMediaItem,
): Promise<void> {
  if (isImage(mediaItem.FilePath)) {
    let LocalPath = join(pubPath(), 'w', issue, '0', mediaItem.FilePath)
    if (!(await pathExists(LocalPath))) {
      LocalPath = join(
        pubPath({
          pub: 'w',
          issue,
          url: `url_${getPrefs<string>('media.langFallback')}.jpg`,
        } as MeetingFile),
        mediaItem.FilePath,
      )
    }
    const FileName = sanitize(
      mediaItem.Caption.length > mediaItem.Label.length
        ? mediaItem.Caption
        : mediaItem.Label,
    )
    const pictureObj: ImageFile = {
      title: FileName,
      filepath: LocalPath,
      filesize: (await stat(LocalPath)).size,
      queryInfo: mediaItem,
    }
    addMediaItemToPart(date, 1, pictureObj)
  } else {
    const media = await getMediaLinks({
      pubSymbol: mediaItem.KeySymbol ?? undefined,
      docId: mediaItem.MepsDocumentId ?? undefined,
      track: mediaItem.Track!,
      issue: mediaItem.IssueTagNumber?.toString(),
    })
    if (media.length > 0) {
      addMediaItemToPart(date, 1, { ...media[0], queryInfo: mediaItem })
    }
  }
}

async function addSongToPart(
  date: string,
  songLangs: string[],
  song: MultiMediaItem,
  i: number,
): Promise<void> {
  const mediaLang = getPrefs<string>('media.lang')
  const fallbackLang = getPrefs<string>('media.langFallback')
  let songMedia: VideoFile[] = await getMediaLinks({
    pubSymbol: song.KeySymbol ?? '',
    track: song.Track ?? 0,
    lang: fallbackLang ? mediaLang : songLangs[i],
  })

  if (fallbackLang && songMedia.length === 0) {
    songMedia = await getMediaLinks({
      pubSymbol: song.KeySymbol ?? '',
      track: song.Track ?? 0,
      lang: mediaLang === songLangs[i] ? fallbackLang : songLangs[i],
    })
  }

  if (songMedia.length > 0) {
    const songObj = songMedia[0]
    songObj.queryInfo = song
    addMediaItemToPart(date, 2 * i, songObj)
  } else {
    error('errorGetWeMedia', new Error('No WE songs found!'))
  }
}
