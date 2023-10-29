import type { Notification } from '~~/types'

export function notify(
  message: string,
  props: Partial<Notification> = {},
  error?: unknown,
) {
  const store = useNotifyStore()
  if (error) {
    props.persistent = true
    props.action = {
      type: 'error',
      label: 'reportIssue',
      url: '',
      error,
    }

    if (props.type === 'warning') {
      log.warn(error)
    } else {
      log.error(error)
    }
  }

  store.show({ message, ...props })
}

export function warn(
  msg: string,
  props: Partial<Notification> = {},
  error?: unknown,
) {
  notify(msg, { type: 'warning', ...props }, error)
}

export function error(msg: string, error: unknown, identifier?: string) {
  notify(msg, { type: 'error', identifier }, error)
}
