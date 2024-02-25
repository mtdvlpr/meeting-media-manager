import { arch, release, type } from 'os'

type Log = Record<number, any[]>

interface Logs {
  error: Log
  warn: Log
  info: Log
  debug: Log
}

const logs: Logs = {
  error: {},
  warn: {},
  info: {},
  debug: {},
}

function logger(type: keyof Logs, args: [msg: any, ...args: any[]]): void {
  const now = +new Date()
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!logs[type][now]) logs[type][now] = []
  logs[type][now].push(
    typeof args[0] === 'string'
      ? args[0]
      : args[0]?.message ?? args[0]?.description,
  )
  // eslint-disable-next-line no-console
  console[type](...args)
}

const IGNORED_ERRORS = [
  'Network Error',
  'timeout of 0ms exceeded',
  'timeout exceeded',
]

export const log = {
  debug(msg: any, ...args: any[]) {
    logger('debug', [msg, ...args])
  },
  info(msg: any, ...args: any[]) {
    logger('info', [msg, ...args])
  },
  warn(msg: any, ...args: any[]) {
    logger('warn', [msg, ...args])
  },
  error(msg: any, ...args: any[]) {
    logger('error', [msg, ...args])
    if (typeof msg !== 'string' && !IGNORED_ERRORS.includes(msg.message)) {
      useNuxtApp().$sentry.captureException(msg)
    }
  },
}

export const bugURL = (error?: unknown): string => {
  const prefs = JSON.stringify(
    Object.fromEntries(
      Object.entries(getAllPrefs()).map(([scope, prefs]) => {
        if (!prefs) return [scope, {}]
        return [
          scope,
          Object.fromEntries(
            Object.entries(prefs).map(
              ([key, value]: [key: string, value: any]) => {
                if (value) {
                  if (scope === 'cong') value = '***'
                  if (key === 'localOutputPath') value = '***'
                  if (key === 'customCachePath') value = '***'
                  if (key === 'password' || key === 'port') value = '***'
                  if (key === 'obs') {
                    if (value.password) value.password = '***'
                  }
                }
                return [key, value]
              },
            ),
          ),
        ]
      }),
    ),
    null,
    2,
  )

  let errorDetails = ''
  if (error) {
    errorDetails = `
### Error details
\`\`\`
${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}
\`\`\``
  }

  const { repo, version } = useRuntimeConfig().public

  return (
    `${repo}/issues/new?template=bug_report.yml&title=[App][Bug]%3A+<title>&version=${version}&logs=${JSON.stringify(
      logs.error,
      null,
      2,
    ).replace(/\n/g, '%0D%0A')}&additional-context=` +
    encodeURIComponent(
      `${type()} ${release()} ${arch()}
### Anonymized \`prefs.json\`
\`\`\`
${prefs}
\`\`\`${errorDetails}`,
    ).replace(/\n/g, '%0D%0A')
  )
}
