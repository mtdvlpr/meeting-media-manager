const startOfWeek = DAYJS_LOCALES.map((l) => {
  return { lang: l, start: 1 }
})

export default defineNuxtPlugin(() => {
  const dayjs = useDayjs()

  DAYJS_LOCALES.forEach((locale) => {
    // Save original start of week
    const original = startOfWeek.find((l) => l.lang === locale)
    if (original) {
      original.start = dayjs().locale(locale).localeData().firstDayOfWeek()
    }

    // Set start of week to Monday
    dayjs.updateLocale(locale, { weekStart: 1 })
  })

  return {
    provide: {
      getWeekStart: (lang: string) =>
        startOfWeek.find((l) => l.lang === lang)?.start ?? 1,
    },
  }
})
