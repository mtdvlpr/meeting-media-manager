import type {
  SmallMediaFile,
  MediaFile,
  Publication,
  Resolution,
} from '~~/types'

export async function getMediaLinks(
  mediaItem: {
    pubSymbol?: string
    docId?: number
    track?: number
    issue?: string
    format?: string
    lang?: string
  },
  silent?: boolean,
): Promise<SmallMediaFile[]> {
  if (mediaItem.lang) {
    log.debug('mi', mediaItem)
    log.debug('ml', getPrefs<string>('media.lang'))
  }
  let smallMediaFiles: SmallMediaFile[] = []

  try {
    const mediaPromises: Promise<SmallMediaFile[]>[] = [
      getSmallMediaFiles(mediaItem, silent),
    ]

    const mediaLang = mediaItem.lang || getPrefs<string>('media.lang')
    const subsLang = getPrefs<string>('media.langSubs')
    const subtitlesEnabled =
      getPrefs<boolean>('media.enableSubtitles') && !!subsLang

    if (subtitlesEnabled && mediaLang !== subsLang) {
      mediaPromises.push(
        getSmallMediaFiles(
          {
            ...mediaItem,
            lang: subsLang,
          },
          silent,
        ),
      )
    }
    const result = await Promise.allSettled(mediaPromises)

    smallMediaFiles = result[0].status === 'fulfilled' ? result[0].value : []
    const subsResult = result[1]

    if (
      subtitlesEnabled &&
      mediaLang !== subsLang &&
      subsResult.status === 'fulfilled'
    ) {
      smallMediaFiles.forEach((file) => {
        const matchingFile = subsResult.value.find(
          (sub) => file.pub === sub.pub && file.track === sub.track,
        )
        if (
          matchingFile &&
          Math.abs(file.duration - matchingFile.duration) < 2
        ) {
          file.subtitles = matchingFile.subtitles
        } else {
          file.subtitles = null
        }
      })
    }

    const promises: Promise<void>[] = []

    // Get thumbnail and primaryCategory
    smallMediaFiles.forEach((item) => {
      if (item.duration > 0) {
        const id = mediaItem.docId
          ? `docid-${mediaItem.docId}_1`
          : `pub-${[
              mediaItem.pubSymbol,
              mediaItem.issue?.toString().replace(/(\d{6})00$/gm, '$1'),
              mediaItem.track,
            ]
              .filter((v) => !!v && v !== '0')
              .join('_')}`

        promises.push(getAdditionalData(item, id))
      }
    })

    await Promise.allSettled(promises)
  } catch (e) {
    if (silent) {
      log.warn(e)
    } else {
      warn(
        'infoPubIgnored',
        {
          identifier: Object.values(mediaItem).filter(Boolean).join('_'),
        },
        e,
      )
    }
  }
  log.debug('smf', smallMediaFiles)
  return smallMediaFiles
}

export async function getSmallMediaFiles(
  mediaItem: {
    pubSymbol?: string
    docId?: number
    track?: number
    issue?: string
    format?: string
    lang?: string
  },
  silent?: boolean,
): Promise<SmallMediaFile[]> {
  let mediaFiles: MediaFile[] = []
  let smallMediaFiles: SmallMediaFile[] = []

  try {
    // From 2008 onward the watchtower has a public and study release
    if (
      mediaItem.pubSymbol === 'w' &&
      mediaItem.issue &&
      parseInt(mediaItem.issue) >= JAN_2008 &&
      mediaItem.issue.toString().slice(-2) === '01'
    ) {
      mediaItem.pubSymbol = 'wp'
    }

    const store = useMediaStore()
    const mediaLang = mediaItem.lang || getPrefs<string>('media.lang')

    // Set correct song publication (e.g. sjj for sign language)
    const mediaLangObj = store.mediaLang
    const fallbackObj = store.fallbackLang
    if (mediaItem.pubSymbol === 'sjj' || mediaItem.pubSymbol === 'sjjm') {
      if (mediaLangObj?.langcode === mediaLang) {
        mediaItem.pubSymbol = mediaLangObj.isSignLanguage ? 'sjj' : 'sjjm'
      } else if (fallbackObj?.langcode === mediaLang) {
        mediaItem.pubSymbol = fallbackObj.isSignLanguage ? 'sjj' : 'sjjm'
      }
    }

    // Get publication from jw api
    let result: any = null

    const params: any = {}
    if (mediaItem.pubSymbol) {
      params.pub = mediaItem.pubSymbol
      params.issue = mediaItem.issue
      params.track = mediaItem.track
      params.fileformat = mediaItem.format
    } else {
      params.docid = mediaItem.docId
    }
    params.langwritten = mediaLang
    const fallbackLang = getPrefs<string>('media.langFallback')

    if (fallbackLang) {
      if (params.pub === 'w' && store.mediaLang?.wAvailable === false) {
        params.langwritten = fallbackLang
      } else if (
        params.pub === 'mwb' &&
        store.mediaLang?.mwbAvailable === false
      ) {
        params.langwritten = fallbackLang
      }
    }

    try {
      result = await fetchPublication(params)
    } catch (e: any) {
      if (!silent && !fallbackLang) {
        log.error(e)
      }

      try {
        const validOptions = ['iasn'] // Has an alternative pub with an extra m
        if (
          !mediaItem.pubSymbol ||
          !validOptions.includes(mediaItem.pubSymbol)
        ) {
          throw e
        }
        log.debug('result1', result ?? e.message)

        result = await fetchPublication({
          pub: mediaItem.pubSymbol + 'm',
          track: mediaItem.track,
          issue: mediaItem.issue,
          fileformat: mediaItem.format,
          langwritten: mediaLang,
        })
      } catch (e: any) {
        log.debug('result2', result ?? e.message)
        if (fallbackLang && !mediaItem.lang) {
          if (params.pub === 'sjj' || params.pub === 'sjjm') {
            params.pub = fallbackObj?.isSignLanguage ? 'sjj' : 'sjjm'
          }
          try {
            result = await fetchPublication({
              ...params,
              langwritten: fallbackLang,
            })
          } catch (e: any) {
            if (!silent) {
              log.error(e)
            }

            try {
              const validOptions = ['iasn'] // Has an alternative pub with an extra m
              if (
                !mediaItem.pubSymbol ||
                !validOptions.includes(mediaItem.pubSymbol)
              ) {
                throw e
              }
              log.debug('result3', result ?? e.message)

              result = await fetchPublication({
                pub: mediaItem.pubSymbol + 'm',
                track: mediaItem.track,
                issue: mediaItem.issue,
                fileformat: mediaItem.format,
                langwritten: fallbackLang,
              })
            } catch (e: any) {
              log.debug('result4', result ?? e.message)
            }
          }
        }
      }
    }

    const publication = result as Publication | null
    if (publication?.files) {
      const categories = Object.values(publication.files)[0]
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      mediaFiles = categories.MP4 ?? Object.values(categories)[0]

      // Filter on max resolution
      mediaFiles = mediaFiles.filter((file) => {
        return (
          parseRes(file.label) <= parseRes(getPrefs<Resolution>('media.maxRes'))
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
          subtitled,
          subtitles,
          markers,
        }) => {
          return <SmallMediaFile>{
            title,
            issue: mediaItem.issue,
            url: file.url,
            checksum: file.checksum,
            filesize,
            duration,
            trackImage: trackImage.url,
            track,
            pub,
            subtitled,
            subtitles: getPrefs<boolean>('media.enableSubtitles')
              ? subtitles
              : null,
            markers,
          }
        },
      )
    } else if (!silent && (!fallbackLang || !mediaItem.lang)) {
      warn('infoPubIgnored', {
        identifier: Object.values(mediaItem).filter(Boolean).join('_'),
      })
    }
  } catch (e) {
    if (silent) {
      log.warn(e)
    } else {
      warn(
        'infoPubIgnored',
        {
          identifier: Object.values(mediaItem).filter(Boolean).join('_'),
        },
        e,
      )
    }
  }
  log.debug('smf', smallMediaFiles)
  return smallMediaFiles
}

async function getAdditionalData(item: SmallMediaFile, id: string) {
  if (item.pub === 'thv') {
    item.thumbnail = THV_POSTER
  } else {
    const result = await fetchMedia(`E/${id}_VIDEO`)

    if (result.media.length > 0) {
      item.thumbnail = result.media[0]?.images?.wss?.sm
      item.primaryCategory = result.media[0]?.primaryCategory
    }
  }
}
