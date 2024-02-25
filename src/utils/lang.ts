import type { LocaleObject } from '@nuxtjs/i18n'

export function translate(word: string, fallback?: string): string {
  const mediaLang = getPrefs<string>('media.lang')
  const { t, locale, locales } = useNuxtApp().$i18n
  const langs = locales.value as LocaleObject[]
  const msgLocale =
    langs.find((l) => l.jw === mediaLang)?.code ?? fallback ?? locale.value

  return t(word, msgLocale)
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
