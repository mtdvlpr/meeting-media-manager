import type { Notification } from '~~/types'

const defaultNotification: Notification = {
  action: undefined, // A button to click
  type: 'info', // Info, warning, error
  dismiss: true, // Whether the user is allowed to dismiss the notification
  identifier: undefined, // A unique identifier (usually a filename or path that triggered the notification)
  message: '', // The message to display
  persistent: false, // Whether the notification dismiss automatically or not
  timestamp: 0, // The timestamp of when the notification was triggered
}

interface State {
  notifications: Notification[]
}

export const useNotifyStore = defineStore('notify', {
  state: (): State => ({
    notifications: [],
  }),
  actions: {
    show(notification: Partial<Notification>) {
      const msg = {
        ...defaultNotification,
        ...notification,
        timestamp: Date.now(),
      }

      const match = this.notifications.find(
        ({ type, message, identifier }) =>
          type === msg.type &&
          message === msg.message &&
          identifier === msg.identifier,
      )

      if (match) {
        match.timestamp = Date.now()
      } else {
        this.notifications.push(msg)
      }
    },
    dismiss(index: number) {
      this.notifications.splice(index, 1)
    },
    dismissByMessage(msg: string) {
      const match = this.notifications.find(({ message }) => message === msg)
      if (match) {
        this.notifications.splice(this.notifications.indexOf(match), 1)
      }
    },
    dismissByMessages(msgs: string[]) {
      msgs.forEach((msg) => {
        this.dismissByMessage(msg)
      })
    },
  },
})
