import type { Dayjs } from 'dayjs'
import type { DateFormat } from '~~/types'

export function getNow() {
  return useDayjs()().hour(0).minute(0).second(0).millisecond(0)
}
export function isMeetingDay(date?: Dayjs) {
  const dayjs = useDayjs()
  const dateToCheck = date ?? dayjs()
  if (!dateToCheck.isValid() || getPrefs<boolean>('meeting.specialCong'))
    return ''
  const mwDay = getMwDay(dateToCheck.startOf('week'))
  const weDay = getPrefs<number>('meeting.weDay')
  const day = dateToCheck.day() === 0 ? 6 : dateToCheck.day() - 1 // Day is 0 indexed and starts with Sunday
  if (day === mwDay) return 'mw'
  if (day === weDay) return 'we'
  return ''
}

export function isCoWeek(baseDate?: Dayjs) {
  const dayjs = useDayjs()
  if (!baseDate) baseDate = dayjs()
  baseDate = baseDate.startOf('week')
  const coWeek = getPrefs<string>('meeting.coWeek')
  const coWeekAsDayJs = dayjs(
    coWeek,
    getPrefs<DateFormat>('app.outputFolderDateFormat'),
  )
  return (
    coWeek &&
    coWeekAsDayJs.isValid() &&
    coWeekAsDayJs.isBetween(baseDate, baseDate.add(6, 'days'), null, '[]')
  )
}

export function getMwDay(baseDate?: Dayjs) {
  if (isCoWeek(baseDate)) {
    // return Tuesday
    return 1
  }
  // return original meeting day
  return getPrefs<number>('meeting.mwDay')
}
