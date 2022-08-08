import {
  SmallMediaFile,
  MultiMediaImage,
  StatStore,
  Perf,
  Stats,
  Origin,
} from '~/types'

const defaultState: StatStore = {
  online: false,
  performance: new Map(),
  downloads: {
    jworg: {
      cache: [],
      live: [],
    },
    cong: {
      cache: [],
      live: [],
    },
  },
}

export const state = () => Object.assign({}, defaultState)

export const mutations = {
  setOnline(state: StatStore, online: boolean) {
    state.online = online
  },
  startPerf(
    state: StatStore,
    { func, start }: { func: string; start: number }
  ) {
    state.performance.set(func, { start, stop: 0 })
  },
  stopPerf(state: StatStore, { func, stop }: { func: string; stop: number }) {
    const perf = state.performance.get(func) as Perf
    perf.stop = stop
    state.performance.set(func, perf)
  },
  setDownloads(
    state: StatStore,
    {
      origin,
      source,
      file,
    }: {
      origin: keyof Stats
      source: keyof Origin
      file: SmallMediaFile | MultiMediaImage
    }
  ) {
    state.downloads[origin][source].push(file)
  },
  clearPerf(state: StatStore) {
    state.performance = new Map()
  },
  clearDownloadStats(state: StatStore) {
    Object.assign(state.downloads, defaultState.downloads)
  },
  clearAll(state: StatStore) {
    Object.assign(state, defaultState)
  },
}
