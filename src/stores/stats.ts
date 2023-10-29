import type { MeetingFile } from '~~/types'

interface Perf {
  start: number
  stop: number
}

interface Origin {
  cache: MeetingFile[]
  live: MeetingFile[]
}

interface Stats {
  jwOrg: Origin
  cong: Origin
}

interface StatStore {
  online: boolean
  navDisabled: boolean
  syncInProgress: string[]
  showMediaPlayback: boolean
  showMusicButton: boolean
  initialLoad: boolean
  updateSuccess: boolean
  performance: Map<string, Perf>
  downloads: Stats
}

const defaultState: StatStore = {
  online: false, // Whether the user is connected to the internet
  navDisabled: false, // Whether navigation is disabled (e.g. when settings are invalid)
  syncInProgress: [], // Which media is currently being synced
  showMediaPlayback: false, // Whether the media playback nav item should be shown
  showMusicButton: false,
  initialLoad: true, // Whether the app is loading for the first time
  updateSuccess: true, // Whether the update was successful
  performance: new Map(), // A map of performance data about how fast a file was downloaded
  downloads: {
    // How much data was fetched from the internet and how much was already in the cache
    jwOrg: {
      cache: [],
      live: [],
    },
    cong: {
      cache: [],
      live: [],
    },
  },
}

export const useStatStore = defineStore('stats', {
  state: (): StatStore => cloneDeep(defaultState),
  actions: {
    setOnline(online: boolean) {
      this.online = online
    },
    setNavDisabled(navDisabled: boolean) {
      this.navDisabled = navDisabled
    },
    setSyncInProgress(date: string, inProgress: boolean) {
      if (!inProgress) {
        const index = this.syncInProgress.indexOf(date)
        if (index !== -1) {
          this.syncInProgress.splice(index, 1)
        }
      } else if (!this.syncInProgress.includes(date)) {
        this.syncInProgress.push(date)
      }
    },
    setShowMediaPlayback(showMediaPlayback: boolean) {
      this.showMediaPlayback = showMediaPlayback
    },
    setShowMusicButton(showMusicButton: boolean) {
      this.showMusicButton = showMusicButton
    },
    setInitialLoad(initialLoad: boolean) {
      this.initialLoad = initialLoad
    },
    setUpdateSuccess(updateSuccess: boolean) {
      this.updateSuccess = updateSuccess
    },
    startPerf({ func, start }: { func: string; start: number }) {
      this.performance.set(func, { start, stop: 0 })
    },
    stopPerf({ func, stop }: { func: string; stop: number }) {
      const perf = this.performance.get(func)
      if (perf) {
        this.performance.set(func, { ...perf, stop })
      }
    },
    clearPerf() {
      this.performance = new Map()
    },
    setDownloads({
      origin,
      source,
      file,
    }: {
      origin: keyof Stats
      source: keyof Origin
      file: MeetingFile
    }) {
      this.downloads[origin][source].push(file)
    },
    clearDownloads() {
      this.downloads = cloneDeep(defaultState.downloads)
    },
    printStats() {
      for (const [func, perf] of [...this.performance.entries()].sort(
        (a, b) => a[1].stop - b[1].stop,
      )) {
        log.info(
          `%c[perf] [${func}] ${(perf.stop - perf.start).toFixed(1)}ms`,
          'background-color: #e2e3e5; color: #41464b;',
        )
      }

      for (const [origin, sources] of Object.entries(this.downloads)) {
        for (const [source, files] of Object.entries(sources)) {
          if ((files as MeetingFile[]).length > 0) {
            log.info(
              `%c[perf] [${origin} Fetch] from ${source}: ${(
                (files as MeetingFile[])
                  .map((file) => file.filesize!)
                  .reduce((a, b) => a + b, 0) /
                BYTES_IN_KIBI_BYTE /
                BYTES_IN_KIBI_BYTE
              ).toFixed(1)}MB`,
              'background-color: #fbe9e7; color: #000;',
            )
          }
        }
      }
    },
  },
})
