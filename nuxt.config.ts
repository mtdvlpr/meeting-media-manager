/* eslint-disable no-console */
import { platform } from 'os'
import { join } from 'path'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { repository, version } from './package.json'
import { APP_LONG_NAME } from './src/constants/general'
import { LOCALES, DAYJS_LOCALES } from './src/constants/lang'
import type { PluginOption } from 'vite'

const isDev = process.env.NODE_ENV === 'development'

const vitePlugins: PluginOption[] = []
const sentryInit =
  !!process.env.SENTRY_DSN &&
  !!process.env.SENTRY_ORG &&
  !!process.env.SENTRY_PROJECT &&
  !!process.env.SENTRY_AUTH_TOKEN

if (sentryInit && !process.env.SENTRY_DISABLE) {
  vitePlugins.push(
    sentryVitePlugin({
      telemetry: false,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: { assets: ['output'] },
      release: {
        name: `${APP_LONG_NAME.toLowerCase().replace(' ', '-')}@${version}`,
        dist: platform().replace('32', ''),
      },
    }),
  )
}

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  srcDir: 'src/',
  ssr: false,
  telemetry: false,
  typescript: {
    shim: false,
    typeCheck: false,
    tsConfig: { compilerOptions: { moduleResolution: 'bundler' } },
  },
  css: ['~/assets/css/main.scss'],
  imports: { dirs: ['stores', 'constants'] },
  router: { options: { hashMode: true } },
  sourcemap: { client: false },
  modules: [
    '@nuxtjs/i18n',
    ['@unocss/nuxt', { configFile: './config/uno.config.ts' }],
    '@vueuse/nuxt',
    'dayjs-nuxt',
    'vuetify-nuxt-module',
    ['@pinia/nuxt', { autoImports: ['defineStore', 'storeToRefs'] }],
    [
      'nuxt-electron',
      {
        build: [{ entry: 'electron/main.ts' }],
        renderer: {
          // Fix for: https://github.com/caoxiemeihao/nuxt-electron/issues/16#issuecomment-1484776511
          resolve:
            process.env.NODE_ENV === 'development'
              ? {
                  'fs-extra': { type: 'cjs' },
                  'obs-websocket-js': { type: 'cjs' },
                }
              : undefined,
        },
      },
    ],
  ],
  i18n: {
    lazy: true,
    langDir: 'locales',
    defaultLocale: 'en',
    locales: LOCALES,
    types: 'composition',
    detectBrowserLanguage: false,
    vueI18n: './config/i18n.config.ts',
    compilation: { strictMessage: false, escapeHtml: false },
  },
  vuetify: {
    moduleOptions: { prefixComposables: true },
    vuetifyOptions: './config/vuetify.config.ts',
  },
  dayjs: {
    locales: DAYJS_LOCALES,
    plugins: [
      'customParseFormat',
      'duration',
      'isBetween',
      'isSameOrBefore',
      'isoWeek',
      'localeData',
      'localizedFormat',
    ],
    defaultLocale: 'en',
  },
  vite: {
    root: process.cwd(), // Fix for: https://github.com/electron-vite/vite-plugin-electron-renderer/issues/32
    build: {
      sourcemap: false,
      cssCodeSplit: true,
      target: 'chrome120',
      rollupOptions: {
        // external: ['chokidar'],
      },
    },
    optimizeDeps: {
      exclude: ['@stephen/sql.js'],
      esbuildOptions: { target: 'chrome120' },
    },
    plugins: vitePlugins,
  },
  nitro: {
    esbuild: { options: { target: 'chrome120' } },
    output: { publicDir: join(__dirname, 'output') },
  },
  runtimeConfig: {
    public: {
      isDev,
      ci: !!process.env.CI,
      version: 'v' + version,
      repo: repository.url.replace('.git', '').replace('mtdvlpr', 'sircharlo'),
      sentryInit,
      sentryDsn: process.env.SENTRY_DSN,
      sentryEnabled: sentryInit && !process.env.SENTRY_DISABLE,
      sentrySourceMaps: process.env.SENTRY_SOURCE_MAPS,
      zoomSdkKey: process.env.ZOOM_SDK_KEY,
      zoomSignatureEndpoint: process.env.ZOOM_SIGNATURE_ENDPOINT,
    },
  },
})
