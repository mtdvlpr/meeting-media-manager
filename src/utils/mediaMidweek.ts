import type { Database } from '@stephen/sql.js'
import { writeJson } from 'fs-extra'
import { join } from 'upath'
import type { MultiMediaExtractRef, DateFormat } from '~~/types'

export async function getMwMedia(date: string) {
  const dayjs = useDayjs()
  const mwDay = dayjs(date, getPrefs<DateFormat>('app.outputFolderDateFormat'))
  const baseDate = mwDay.startOf('week')

  let issue = baseDate.format('YYYYMM') + '00'
  if (parseInt(baseDate.format('M')) % 2 === 0) {
    issue = baseDate.subtract(1, 'month').format('YYYYMM') + '00'
  }

  // Get document id of this weeks mwb issue
  const db = await getDbFromJWPUB({ pub: 'mwb', issue, date })
  if (!db) throw new Error(`No MW media data found for ${date}!`)
  const docId = executeQuery<{ DocumentId: number }>(
    db,
    `SELECT DocumentId FROM DatedText WHERE FirstDateOffset = ${baseDate.format(
      'YYYYMMDD',
    )}`,
  )[0]?.DocumentId

  // Return without error if no docId found (e.g. memorial week)
  if (!docId) return

  const treasures = executeQuery<{ FeatureTitle: string }>(
    db,
    'SELECT FeatureTitle FROM Document WHERE Class = 21',
  )[0]
  const apply = executeQuery<{ FeatureTitle: string }>(
    db,
    'SELECT FeatureTitle FROM Document WHERE Class = 94',
  )[0]
  const living = executeQuery<{ FeatureTitle: string }>(
    db,
    'SELECT FeatureTitle FROM Document WHERE Class = 10 ORDER BY FeatureTitle',
  )
  let livingTitle = living[0]?.FeatureTitle
  if (living.length > 1) {
    livingTitle = living[Math.floor(living.length / 2)]?.FeatureTitle
  }

  if (treasures?.FeatureTitle && apply?.FeatureTitle && livingTitle) {
    writeJson(join(pubPath()!, 'mwb', 'headings.json'), {
      treasures: treasures.FeatureTitle,
      apply: apply.FeatureTitle,
      living: livingTitle,
    })
  }

  // Get document multimedia and add them to the media list
  const mms = await getDocumentMultiMedia(db, docId)
  const promises: Promise<void>[] = []

  // remove the last song if it's the co week
  if (isCoWeek(baseDate)) {
    let lastSongIdLookup = mms
      .reverse()
      .findIndex(
        (m) =>
          m.BeginParagraphOrdinal &&
          m.BeginParagraphOrdinal >= LAST_SONG_PAR_NR,
      )
    if (lastSongIdLookup === -1) {
      lastSongIdLookup = mms
        .reverse()
        .findIndex((m) => m.pub === useMediaStore().songPub)
    }
    mms.splice(lastSongIdLookup, 1)
  }
  mms.forEach((mm) => {
    addMediaItemToPart(date, mm.BeginParagraphOrdinal ?? 0, mm, 'internal')
  })

  // Get document extracts and add them to the media list
  const extracts = await getDocumentExtract({
    db,
    docId,
    baseDate,
    date,
  })

  extracts.forEach((extract) => {
    addMediaItemToPart(
      date,
      extract.BeginParagraphOrdinal ?? 0,
      extract,
      'external',
    )
  })

  // Get document multimedia of internal references
  const internalRefs = executeQuery<MultiMediaExtractRef>(
    db,
    `SELECT DocumentInternalLink.DocumentId AS SourceDocumentId, DocumentInternalLink.BeginParagraphOrdinal, Document.DocumentId FROM DocumentInternalLink INNER JOIN InternalLink ON DocumentInternalLink.InternalLinkId = InternalLink.InternalLinkId INNER JOIN Document ON InternalLink.MepsDocumentId = Document.MepsDocumentId WHERE DocumentInternalLink.DocumentId = ${docId} AND Document.Class <> 94`,
  )

  internalRefs.forEach((ref) => {
    promises.push(processInternalRefs(db, ref, date))
  })

  await Promise.allSettled(promises)
}

async function processInternalRefs(
  db: Database,
  ref: MultiMediaExtractRef,
  date: string,
) {
  const promises: Promise<void>[] = []

  // Process internalRefs of the internalRefs
  const internalRefs = executeQuery<MultiMediaExtractRef>(
    db,
    `SELECT DocumentInternalLink.DocumentId AS SourceDocumentId, DocumentInternalLink.BeginParagraphOrdinal, Document.DocumentId FROM DocumentInternalLink INNER JOIN InternalLink ON DocumentInternalLink.InternalLinkId = InternalLink.InternalLinkId INNER JOIN Document ON InternalLink.MepsDocumentId = Document.MepsDocumentId WHERE DocumentInternalLink.DocumentId = ${ref.DocumentId} AND Document.Class <> 94`,
  )

  internalRefs.forEach((ref) => {
    promises.push(processInternalRefs(db, ref, date))
  })

  const refMedia = await getDocumentMultiMedia(db, ref.DocumentId)

  refMedia.forEach((refMediaFile) => {
    addMediaItemToPart(
      date,
      ref.BeginParagraphOrdinal,
      refMediaFile,
      'internal',
    )
  })

  await Promise.allSettled(promises)
}
