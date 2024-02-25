import { platform } from 'os'
import {
  init,
  setContext,
  captureException,
  setUser,
  browserTracingIntegration,
} from '@sentry/vue'

export default defineNuxtPlugin((nuxtApp) => {
  const { isDev, sentryDsn, sentryInit, sentryEnabled } =
    useRuntimeConfig().public

  if (sentryInit) {
    const router = useRouter()

    init({
      app: nuxtApp.vueApp,
      dsn: sentryDsn,
      dist: platform().replace('32', ''),
      enabled: sentryEnabled,
      environment: isDev ? 'development' : 'production',
      tracesSampleRate: isDev ? 1 : 0.1,
      integrations: [browserTracingIntegration({ router })],
    })
  }

  return {
    provide: {
      sentry: { setUser, setContext, captureException },
    },
  }
})
