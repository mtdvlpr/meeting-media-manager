export default function (weekNr: Ref<number>) {
  const dayjs = useDayjs()
  const baseDate = computed(() => {
    let y = 0
    if (weekNr.value < dayjs().isoWeek()) y = 1
    const week = dayjs().startOf('week').add(y, 'years').isoWeek(weekNr.value)
    return week.startOf('week')
  })
  return { baseDate }
}
