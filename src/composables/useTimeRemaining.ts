import type { Dayjs } from 'dayjs'
import type { Duration } from 'dayjs/plugin/duration'

export default function (stop: Dayjs | number, onStop: () => void) {
  const dayjs = useDayjs()
  let interval: NodeJS.Timeout | null = null
  let initialSeconds = 0

  const stopInterval = (executeOnStop = false) => {
    if (interval) {
      clearInterval(interval)
      interval = null
    }
    if (executeOnStop) onStop()
  }

  if (typeof stop === 'number') {
    initialSeconds = SEC_IN_MIN * stop
  } else {
    initialSeconds = stop.diff(dayjs(), 's')
    if (initialSeconds <= 0) {
      stopInterval()
    }
  }

  const formatDuration = (duration: Duration) => {
    if (duration.hours() > 0) {
      return duration.format('HH:mm:ss')
    } else {
      return duration.format('mm:ss')
    }
  }

  const ms = ref(initialSeconds * MS_IN_SEC)
  const duration = computed(() => dayjs.duration(ms.value, 'ms'))
  const formatted = computed(() => formatDuration(duration.value))
  interval = setInterval(() => {
    ms.value -= MS_IN_SEC
    if (ms.value <= 0) {
      stopInterval(true)
    }
  }, MS_IN_SEC)

  return { ms, formatted }
}
