import type { MediaItem } from '~~/types'

export async function getLatestJWMedia(categories: string[]) {
  const promises: Promise<MediaItem[]>[] = []
  const media: MediaItem[] = []

  const lang = getPrefs<string>('media.lang')
  const fallback = getPrefs<string>('media.langFallback')

  try {
    categories.forEach((category) => {
      promises.push(getCategoryMedia(category, lang))
      if (fallback && fallback !== lang) {
        promises.push(getCategoryMedia(category, fallback))
      }
    })

    const results = await Promise.allSettled(promises)
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        media.push(...result.value)
      }
    })
  } catch (e) {
    log.error(e)
  }

  return media
    .filter(function (item, pos, self) {
      return self.findIndex((i) => i.guid === item.guid) === pos
    })
    .filter((item, _, self) => {
      return (
        item.naturalKey.includes(`_${lang}_`) ||
        !self.find(
          (i) =>
            i.languageAgnosticNaturalKey === item.languageAgnosticNaturalKey &&
            i.naturalKey.includes(`_${lang}_`),
        )
      )
    })
}

async function getCategoryMedia(
  category: string,
  lang?: string,
): Promise<MediaItem[]> {
  try {
    const result = await fetchMediaCategories(
      (lang ?? getPrefs<string>('media.lang')) + `/${category}`,
      {
        detailed: 1,
      },
    )
    const categoryMedia = result.category.media || []
    const subcategoriesMedia: MediaItem[] =
      result.category.subcategories
        ?.filter((subcategory) => subcategory.media)
        .flatMap((subcategory) => subcategory.media || []) || []
    const items = categoryMedia.concat(subcategoriesMedia)
    const enableSubs = getPrefs<boolean>('media.enableSubtitles')
    const subsLang = getPrefs<string>('media.langSubs')
    const newItems = []
    for (const item of items) {
      if (enableSubs && subsLang && subsLang !== lang) {
        newItems.push(await getMediaItemSubs(item, subsLang))
      } else if (!enableSubs || !subsLang) {
        newItems.push({
          ...item,
          files: item.files.map((file) => ({ ...file, subtitles: null })),
        })
      } else {
        newItems.push(item)
      }
    }
    return newItems
  } catch (e) {
    log.error(e)
  }
  return []
}

async function getMediaItemSubs(
  item: MediaItem,
  lang: string,
): Promise<MediaItem> {
  const result = await fetchMedia(`${lang}/${item.languageAgnosticNaturalKey}`)
  return {
    ...item,
    files: item.files.map((file) => {
      const match = result.media[0]?.files.find((f) => f.label === file.label)
      return { ...file, subtitles: match?.subtitles ?? null }
    }),
  }
}
