import { pathExists, readJson, readJsonSync, writeJson } from 'fs-extra'
import { join } from 'upath'
import type { ShortJWLang, JWLang, Filter, Choice } from '~~/types'

export async function getJWLangs(forceReload = false): Promise<ShortJWLang[]> {
  const { $dayjs } = useNuxtApp()
  const langPath = join(appPath(), 'langs.json')
  const lastUpdate = getPrefs<string>('media.langUpdatedLast')
  const recentlyUpdated =
    lastUpdate && $dayjs(lastUpdate).isAfter($dayjs().subtract(3, 'months'))
  let langs: ShortJWLang[] = []

  if (forceReload || !(await pathExists(langPath)) || !recentlyUpdated) {
    try {
      const result = await fetchJson<{ languages: JWLang[] }>(
        'https://www.jw.org/en/languages',
      )
      log.debug('Result from langs call:', result)
      langs = result.languages
        .filter((lang) => lang.hasWebContent)
        .map((lang) => {
          return {
            name: lang.name,
            langcode: lang.langcode,
            symbol: lang.symbol,
            vernacularName: lang.vernacularName,
            isSignLanguage: lang.isSignLanguage,
          }
        })
      if (!Array.isArray(langs) || langs.length === 0) {
        throw new Error('Langs array does not contain expected data')
      }
    } catch (e) {
      log.error(e)
      log.debug('Falling back to fallback langs')
      langs = FALLBACK_SITE_LANGS
    }
    try {
      await writeJson(langPath, langs, { spaces: 2 })
      log.debug('Wrote langs to file')
      setPrefs('media.langUpdatedLast', $dayjs().toISOString())
    } catch (error: any) {
      log.error(error)
    }
  }

  if (!Array.isArray(langs) || langs.length === 0) {
    try {
      langs = readJsonSync(langPath) as ShortJWLang[]
      if (!Array.isArray(langs) || langs.length === 0) {
        throw new Error('Langs file does not contain expected data')
      }
    } catch (e: any) {
      log.error(e, 'Setting fallback langs as a workaround')
      langs = FALLBACK_SITE_LANGS
    }
  }

  const mediaLang = getPrefs<string>('media.lang')
  const fallbackLang = getPrefs<string>('media.langFallback')
  const langPrefInLangs = langs.find((lang) => lang.langcode === mediaLang)
  const fallbackLangObj = langs.find((lang) => lang.langcode === fallbackLang)
  let availabilityUpdated = false

  // Check current lang if it hasn't been checked yet
  if (
    mediaLang &&
    langPrefInLangs &&
    (langPrefInLangs.mwbAvailable === undefined ||
      langPrefInLangs.wAvailable === undefined)
  ) {
    const availability = await getPubAvailability(mediaLang, langs)
    langPrefInLangs.wAvailable = availability.w
    langPrefInLangs.mwbAvailable = availability.mwb
    availabilityUpdated = true
  }

  if (
    fallbackLang &&
    fallbackLangObj &&
    (fallbackLangObj.mwbAvailable === undefined ||
      fallbackLangObj.wAvailable === undefined)
  ) {
    const availability = await getPubAvailability(fallbackLang, langs)
    fallbackLangObj.wAvailable = availability.w
    fallbackLangObj.mwbAvailable = availability.mwb
    availabilityUpdated = true
  }

  const store = useMediaStore()
  store.setMediaLang(langPrefInLangs ?? null)
  store.setFallbackLang(fallbackLangObj ?? null)
  store.setSongPub(langPrefInLangs?.isSignLanguage ? 'sjj' : 'sjjm')

  if (availabilityUpdated) {
    try {
      await writeJson(langPath, langs, { spaces: 2 })
      log.debug('Wrote langs to file')
      setPrefs('media.langUpdatedLast', $dayjs().toISOString())
    } catch (error: any) {
      log.error(error)
    }
  }

  return langs
}

export async function getPubAvailability(
  lang: string,
  langs?: ShortJWLang[],
): Promise<{ lang: string; w?: boolean; mwb?: boolean }> {
  let mwb
  let w

  log.debug(`Checking availability of ${lang}`)

  const url = (cat: string, filter: string, lang: string) =>
    `https://www.jw.org/en/library/${cat}/json/filters/${filter}/?contentLanguageFilter=${lang}`

  try {
    const langPath = join(appPath(), 'langs.json')
    if (!langs) {
      if (!(await pathExists(langPath))) return { lang, w, mwb }
      langs = <ShortJWLang[]>((await readJson(langPath)) ?? '[]')
    }

    const langObject = langs.find((l) => l.langcode === lang)
    if (!langObject) return { lang, w, mwb }
    if (
      langObject.mwbAvailable !== undefined &&
      langObject.wAvailable !== undefined
    ) {
      return { lang, w: langObject.wAvailable, mwb: langObject.mwbAvailable }
    }

    const wAvailabilityEndpoint = url(
      'magazines',
      'MagazineViewsFilter',
      langObject.symbol,
    )
    const mwbAvailabilityEndpoint = url(
      'jw-meeting-workbook',
      'IssueYearViewsFilter',
      langObject.symbol,
    )

    const result = await Promise.allSettled([
      $fetch<Filter>(mwbAvailabilityEndpoint),
      $fetch<Filter>(wAvailabilityEndpoint),
    ])

    const mwbResult = result[0]
    const wResult = result[1]

    if (mwbResult.status === 'fulfilled') {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (mwbResult.value.choices) {
        mwb = mwbResult.value.choices.some(
          (c: Choice) => c.optionValue === new Date().getFullYear(),
        )
      } else {
        log.error(mwbResult.value)
      }
    }
    if (wResult.status === 'fulfilled') {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (wResult.value.choices) {
        w = wResult.value.choices.some((c: Choice) => c.optionValue === 'w')
      } else {
        log.error(wResult.value)
      }
    }

    langObject.mwbAvailable = mwb
    langObject.wAvailable = w
    try {
      await writeJson(langPath, langs, { spaces: 2 })
    } catch (error) {
      log.error(error)
    }
  } catch (e) {
    log.error(e)
  }

  return { lang, mwb, w }
}
