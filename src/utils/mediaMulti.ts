import { pathExists, stat } from 'fs-extra'
import { join } from 'upath'
import type { Database } from '@stephen/sql.js'
import type {
  MeetingFile,
  VideoFile,
  ImageFile,
  MultiMediaItem,
} from '~~/types'

export async function getDocumentMultiMedia(
  db: Database,
  docId: number | null,
  mepsId?: number,
  lang?: string,
  memOnly?: boolean,
  silent?: boolean,
): Promise<MeetingFile[]> {
  const result = executeQuery(
    db,
    "SELECT * FROM sqlite_master WHERE type='table' AND name='DocumentMultimedia'",
  )

  const mmTable = result.length === 0 ? 'Multimedia' : 'DocumentMultimedia'

  const uniqueEnglishSymbol = executeQuery<{ UniqueEnglishSymbol: string }>(
    db,
    'SELECT UniqueEnglishSymbol FROM Publication',
  )[0].UniqueEnglishSymbol

  const keySymbol = /[^a-zA-Z0-9]/.test(uniqueEnglishSymbol)
    ? uniqueEnglishSymbol
    : uniqueEnglishSymbol.replace(/\d/g, '')

  const issueTagNumber = executeQuery<{ IssueTagNumber: string }>(
    db,
    'SELECT IssueTagNumber FROM Publication',
  )[0].IssueTagNumber

  const targetParNrExists = executeQuery<{ name: string }>(
    db,
    "PRAGMA table_info('Question')",
  )
    .map((item) => item.name)
    .includes('TargetParagraphNumberLabel')

  const suppressZoomExists = executeQuery<{ name: string }>(
    db,
    "PRAGMA table_info('Multimedia')",
  )
    .map((item) => item.name)
    .includes('SuppressZoom')

  const mmItems: MeetingFile[] = []

  let select = `SELECT ${mmTable}.DocumentId, ${mmTable}.MultimediaId, Multimedia.MimeType, Multimedia.DataType, Multimedia.MajorType, Multimedia.MepsLanguageIndex, Multimedia.FilePath, Multimedia.Label, Multimedia.Caption, Multimedia.CategoryType`
  let from = `FROM ${mmTable} INNER JOIN Document ON ${mmTable}.DocumentId = Document.DocumentId`
  let where = `WHERE ${
    docId || docId === 0
      ? `${mmTable}.DocumentId = ${docId}`
      : `Document.MepsDocumentId = ${mepsId}`
  }`
  let groupAndSort = ''

  const includePrinted = getPrefs<boolean>('media.includePrinted')
  const videoString = `(Multimedia.MimeType LIKE '%video%' OR Multimedia.MimeType LIKE '%audio%')`
  const imgString = `(Multimedia.MimeType LIKE '%image%' ${
    includePrinted
      ? ''
      : 'AND Multimedia.CategoryType <> 4 AND Multimedia.CategoryType <> 6'
  } AND Multimedia.CategoryType <> 9 AND Multimedia.CategoryType <> 10 AND Multimedia.CategoryType <> 25)`

  where += ` AND (${videoString} OR ${imgString})`

  if (mmTable === 'DocumentMultimedia') {
    select += `, ${mmTable}.BeginParagraphOrdinal, ${mmTable}.EndParagraphOrdinal, Extract.Link, Multimedia.KeySymbol, Multimedia.MepsDocumentId AS MultiMeps, Document.MepsDocumentId, Multimedia.Track, Multimedia.IssueTagNumber`
    from += ` INNER JOIN Multimedia ON Multimedia.MultimediaId = ${mmTable}.MultimediaId LEFT JOIN DocumentExtract ON DocumentExtract.DocumentId = ${mmTable}.DocumentId AND DocumentExtract.BeginParagraphOrdinal = ${mmTable}.BeginParagraphOrdinal AND DocumentExtract.EndParagraphOrdinal = ${mmTable}.EndParagraphOrdinal LEFT JOIN Extract ON Extract.ExtractId = DocumentExtract.ExtractId`
    groupAndSort = `GROUP BY ${mmTable}.MultimediaId ORDER BY ${mmTable}.BeginParagraphOrdinal`

    if (targetParNrExists) {
      select += `, Question.TargetParagraphNumberLabel`
      from += ` LEFT JOIN Question ON Question.DocumentId = ${mmTable}.DocumentId AND Question.TargetParagraphOrdinal = ${mmTable}.BeginParagraphOrdinal`
    }
  }

  if (suppressZoomExists) {
    select += `, Multimedia.SuppressZoom`
    where += ` AND Multimedia.SuppressZoom <> 1`
  }

  const promises: Promise<VideoFile | ImageFile | null>[] = []

  const items = executeQuery<MultiMediaItem>(
    db,
    `${select} ${from} ${where} ${groupAndSort}`,
  )

  items.forEach((mmItem) => {
    promises.push(
      processMultiMediaItem(
        db,
        mmItem,
        targetParNrExists,
        !!silent,
        keySymbol,
        issueTagNumber,
        !!memOnly,
        lang,
      ),
    )
  })

  const results = await Promise.allSettled(promises)
  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      if (result.value) {
        mmItems.push(result.value)
      }
    }
  })
  return mmItems
}

async function processMultiMediaItem(
  db: Database,
  mmItem: MultiMediaItem,
  targetParNrExists: boolean,
  silent: boolean,
  keySymbol: string,
  issueTagNumber: string,
  memOnly: boolean,
  lang?: string,
) {
  if (mmItem.MepsLanguageIndex) {
    const mepsLang = MEPS_IDS[mmItem.MepsLanguageIndex]
    if (mepsLang) lang = mepsLang
  } else if (mmItem.Link) {
    try {
      const matches = mmItem.Link.match(/\/(.*)\//)
      if (matches && matches.length > 0) {
        lang = matches.pop()!.split(':')[0]
      }
    } catch (e) {
      log.error(e)
    }
  } else if (mmItem.FilePath) {
    const extractedLang = mmItem.FilePath.split('_')[1]
    const langs = await getJWLangs()
    if (langs.find((l) => l.langcode === extractedLang)) {
      lang = extractedLang
    }
  }
  if (targetParNrExists) {
    const result = executeQuery(
      db,
      `SELECT TargetParagraphNumberLabel From Question WHERE DocumentId = ${mmItem.DocumentId} AND TargetParagraphOrdinal = ${mmItem.BeginParagraphOrdinal}`,
    )
    if (result.length === 1) Object.assign(mmItem, result[0])
    if (
      executeQuery<{ Count: number }>(
        db,
        'SELECT COUNT(*) AS Count FROM Question',
      )[0].Count > 0
    ) {
      mmItem.tableQuestionIsUsed = true
      const result = executeQuery<{
        TargetParagraphNumberLabel: string
        TargetParagraphOrdinal: number
      }>(
        db,
        `SELECT TargetParagraphNumberLabel, TargetParagraphOrdinal From Question WHERE DocumentId = ${mmItem.DocumentId} AND TargetParagraphOrdinal > ${mmItem.BeginParagraphOrdinal} LIMIT 1`,
      )
      if (result.length > 0)
        mmItem.NextParagraphOrdinal = result[0].TargetParagraphOrdinal
    }
  }
  const fallbackLang = getPrefs<string>('media.langFallback')
  try {
    // Get Video file
    if (
      mmItem.MimeType.includes('audio') ||
      mmItem.MimeType.includes('video')
    ) {
      const mediaLang = getPrefs<string>('media.lang')

      let json: VideoFile = (
        await getMediaLinks(
          {
            pubSymbol: mmItem.KeySymbol ?? '',
            track: mmItem.Track ?? 0,
            issue: (mmItem.IssueTagNumber ?? 0).toString(),
            docId: mmItem.MultiMeps ?? 0,
            lang: fallbackLang ? mediaLang : lang,
          },
          silent,
        )
      )[0]

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!json && fallbackLang) {
        json = (
          await getMediaLinks(
            {
              pubSymbol: mmItem.KeySymbol ?? '',
              track: mmItem.Track ?? 0,
              issue: (mmItem.IssueTagNumber ?? 0).toString(),
              docId: mmItem.MultiMeps ?? 0,
              lang: lang === mediaLang ? fallbackLang : lang ?? fallbackLang,
            },
            silent,
          )
        )[0]
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      } else if (!json) {
        json = <VideoFile>{}
      }
      json.queryInfo = mmItem
      json.BeginParagraphOrdinal = mmItem.BeginParagraphOrdinal
      return json
    } else {
      if (!mmItem.KeySymbol) {
        mmItem.KeySymbol = keySymbol
        mmItem.IssueTagNumber = +issueTagNumber
        if (!memOnly) {
          mmItem.LocalPath = join(
            pubPath({
              BeginParagraphOrdinal: 0,
              title: '',
              queryInfo: mmItem,
            } as ImageFile)!,
            mmItem.FilePath,
          )

          if (lang && !mmItem.Link && !(await pathExists(mmItem.LocalPath))) {
            mmItem.LocalPath = join(
              pubPath(<MeetingFile>{
                BeginParagraphOrdinal: 0,
                title: '',
                url: `url_${lang}.jpg`,
                queryInfo: mmItem,
              })!,
              mmItem.FilePath,
            )
          }

          if (fallbackLang && !(await pathExists(mmItem.LocalPath))) {
            mmItem.LocalPath = join(
              pubPath(<MeetingFile>{
                BeginParagraphOrdinal: 0,
                title: '',
                url: `url_${fallbackLang}.jpg`,
                queryInfo: mmItem,
              })!,
              mmItem.FilePath,
            )
          }
        }
      }

      mmItem.FileName = sanitize(
        mmItem.Caption.length > mmItem.Label.length
          ? mmItem.Caption
          : mmItem.Label,
      )

      const picture: ImageFile = {
        BeginParagraphOrdinal: mmItem.BeginParagraphOrdinal,
        title: mmItem.FileName,
        queryInfo: mmItem,
        filepath: memOnly ? undefined : mmItem.LocalPath,
        filesize: memOnly ? undefined : (await stat(mmItem.LocalPath!)).size,
      }

      return picture
    }
  } catch (e) {
    warn(
      'errorJwpubMediaExtract',
      {
        identifier: `${keySymbol}-${issueTagNumber}`,
      },
      e,
    )
  }
  return null
}
