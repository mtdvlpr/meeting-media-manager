import type { Dayjs } from 'dayjs'
import type { Database } from '@stephen/sql.js'
import type { MeetingFile, MultiMediaExtract } from '~~/types'

export async function getDocumentExtract({
  db,
  docId,
  baseDate,
  date,
}: {
  db: Database
  docId: number
  baseDate: Dayjs
  date?: string
}) {
  const songPub = useMediaStore().songPub
  const excludeTh = getPrefs<boolean>('media.excludeTh')
  let extractMultimediaItems: MeetingFile[] = []

  const extracts = executeQuery<MultiMediaExtract>(
    db,
    `SELECT DocumentExtract.BeginParagraphOrdinal,DocumentExtract.EndParagraphOrdinal,DocumentExtract.DocumentId,
      Extract.RefMepsDocumentId,Extract.RefPublicationId,Extract.RefMepsDocumentId,UniqueEnglishSymbol,IssueTagNumber,
      Extract.RefBeginParagraphOrdinal,Extract.RefEndParagraphOrdinal, Extract.Link
    FROM DocumentExtract
      INNER JOIN Extract ON DocumentExtract.ExtractId = Extract.ExtractId
      INNER JOIN RefPublication ON Extract.RefPublicationId = RefPublication.RefPublicationId
      INNER JOIN Document ON DocumentExtract.DocumentId = Document.DocumentId
    WHERE DocumentExtract.DocumentId = ${docId}
      AND NOT RefPublication.PublicationCategorySymbol = 'web'
      ${songPub === 'sjjm' ? "AND NOT UniqueEnglishSymbol = 'sjj' " : ''}
      AND NOT UniqueEnglishSymbol LIKE 'mwbr%'
      ${excludeTh ? "AND NOT UniqueEnglishSymbol = 'th' " : ''}
    ORDER BY DocumentExtract.BeginParagraphOrdinal`,
  )

  const promises: Promise<MeetingFile[]>[] = []

  extracts.forEach((extract) => {
    let imagesOnly = false
    const excludeLffImages = getPrefs<boolean>('media.excludeLffImages')
    if (extract.UniqueEnglishSymbol === 'lffi') {
      imagesOnly = true
    } else if (extract.UniqueEnglishSymbol === 'lff') {
      const match = extracts.find(
        (e) =>
          e.UniqueEnglishSymbol === 'lff' &&
          e.BeginParagraphOrdinal !== extract.BeginParagraphOrdinal,
      )
      imagesOnly =
        !!match && extract.BeginParagraphOrdinal < match.BeginParagraphOrdinal
    }

    const skipCBS =
      isCoWeek(baseDate) && extract.UniqueEnglishSymbol === 'lff' && !imagesOnly

    if (!skipCBS && (!imagesOnly || !excludeLffImages)) {
      promises.push(extractMediaItems({ extract, imagesOnly, date }))
    }
  })

  const result = await Promise.allSettled(promises)

  result.forEach((mediaItems) => {
    if (mediaItems.status === 'fulfilled') {
      extractMultimediaItems = extractMultimediaItems.concat(mediaItems.value)
    }
  })

  return extractMultimediaItems
}

async function extractMediaItems({
  extract,
  imagesOnly = false,
  date,
}: {
  extract: MultiMediaExtract
  imagesOnly?: boolean
  date?: string
}) {
  extract.Lang = getPrefs<string>('media.lang')
  if (extract.Link) {
    try {
      const matches = extract.Link.match(/\/(.*)\//)
      if (matches && matches.length > 0) {
        extract.Lang = matches.pop()!.split(':')[0]
      }
    } catch (e) {
      log.error(e)
    }
  }

  const symbol = /[^a-zA-Z0-9]/.test(extract.UniqueEnglishSymbol)
    ? extract.UniqueEnglishSymbol
    : extract.UniqueEnglishSymbol.replace(/\d/g, '')

  // Exclude the "old new songs" songbook, as we don't need images from that
  if (symbol === 'snnw') return []
  const mediaLang = getPrefs<string>('media.lang')
  const fallbackLang = getPrefs<string>('media.langFallback')

  let extractDb = await getDbFromJWPUB({
    pub: symbol,
    issue: extract.IssueTagNumber,
    lang: fallbackLang ? mediaLang : extract.Lang,
    date,
  })

  if (!extractDb && fallbackLang) {
    extractDb = await getDbFromJWPUB({
      pub: symbol,
      issue: extract.IssueTagNumber,
      lang:
        extract.Lang === mediaLang
          ? fallbackLang
          : extract.Lang || fallbackLang,
      date,
    })
  }

  if (!extractDb) return []

  return (
    await getDocumentMultiMedia(
      extractDb,
      null,
      extract.RefMepsDocumentId,
      extract.Lang,
    )
  )
    .filter((mmItem) => {
      if (imagesOnly && isVideo(mmItem.queryInfo?.FilePath ?? '')) {
        return false
      }

      if (
        mmItem.queryInfo?.tableQuestionIsUsed &&
        mmItem.queryInfo.NextParagraphOrdinal &&
        !mmItem.queryInfo.TargetParagraphNumberLabel
      ) {
        mmItem.BeginParagraphOrdinal = mmItem.queryInfo.NextParagraphOrdinal
      }

      // Include videos with no specific paragraph for sign language, as they are sometimes used (ie the CBS chapter video)
      const mediaLang = useMediaStore().mediaLang
      if (
        mediaLang?.isSignLanguage &&
        !!mmItem.queryInfo?.FilePath &&
        isVideo(mmItem.queryInfo.FilePath) &&
        !mmItem.queryInfo.TargetParagraphNumberLabel
      ) {
        return true
      }
      // Always include header image of Live Forever lesson
      else if (
        extract.UniqueEnglishSymbol === 'lff' &&
        mmItem.BeginParagraphOrdinal === 1
      ) {
        return true
      } else if (
        mmItem.BeginParagraphOrdinal &&
        extract.RefBeginParagraphOrdinal &&
        extract.RefEndParagraphOrdinal
      ) {
        return (
          extract.RefBeginParagraphOrdinal <= mmItem.BeginParagraphOrdinal &&
          mmItem.BeginParagraphOrdinal <= extract.RefEndParagraphOrdinal
        )
      } else {
        return true
      }
    })
    .map((mmItem) => {
      mmItem.BeginParagraphOrdinal = extract.BeginParagraphOrdinal
      return mmItem
    })
}
