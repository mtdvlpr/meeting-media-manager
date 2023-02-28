import { LocaleObject } from '@nuxtjs/i18n/dist/runtime/composables'

export function translate(word: string, fallback?: string) {
  const mediaLang = getPrefs<string>('media.lang')
  const { $i18n } = useNuxtApp()
  const langs = $i18n.locales as LocaleObject[]
  const locale =
    langs.find((l) => l.jw === mediaLang)?.code ?? fallback ?? $i18n.locale

  return $i18n.t(word, locale) as string
}

export function convertSignLang(symbol: string) {
  return symbol
    .replace('ase', 'en') // American Sign Language
    .replace('bfi', 'en') // British Sign Language
    .replace('bzs', 'pt')
    .replace('rsl', 'ru')
    .replace('gsg', 'de')
    .replace('ssp', 'es')
    .replace('fse', 'fi')
    .replace('fsl', 'fr')
    .replace('ise', 'it')
    .replace('dse', 'nl')
    .replace('rms', 'ro')
    .replace('hsh', 'hu')
    .replace('psr', 'pt-pt')
    .replace('swl', 'sv')
    .replace('mzc', 'mg')
}
