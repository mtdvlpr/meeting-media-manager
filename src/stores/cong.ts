import type { WebDAVClient } from 'webdav/web/types'
import type { CongFile, PrefStore } from '~~/types'

interface CongStore {
  client: WebDAVClient | null
  contents: CongFile[]
  contentsTree: CongFile[]
  prefs: Partial<PrefStore> | null
}

export const useCongStore = defineStore('cong', {
  state: (): CongStore => ({
    client: null, // The WebDAV client
    contents: [], // The contents of the directory (Media, Hidden, ForcedPrefs)
    contentsTree: [], // The contents of the directory in a tree format (children property)
    prefs: null, // The preferences that are forced by the server
  }),
})
