import type { Shortcut } from '~~/types'

interface Screen {
  id: number
  class: string
  title: string
}

interface PresentStore {
  mediaScreenInit: boolean
  mediaScreenVisible: boolean
  background: string
  screens: Screen[]
  shortcuts: Shortcut[]
}

const defaultState: PresentStore = {
  mediaScreenInit: false, // Whether the media screen has been initialized (is it open)
  mediaScreenVisible: true, // Whether the media screen is visible (is it minimized or not)
  background: '', // Either html of the yeartext (<p>...</p>) or a URL to the custom background
  screens: [], // The available monitors
  shortcuts: [], // The shortcuts that have been registered
}

export const usePresentStore = defineStore('present', {
  state: (): PresentStore => cloneDeep(defaultState),
  actions: {
    setBackground(bg: string) {
      this.background = bg
    },
    setMediaScreenInit(init: boolean) {
      this.mediaScreenInit = init
    },
    setMediaScreenVisible(visible: boolean) {
      this.mediaScreenVisible = visible
    },
    setScreens(screens: Screen[]) {
      this.screens = screens
    },
    addScreen(screen: Screen) {
      this.screens.push(screen)
    },
    addShortcut(shortcut: Shortcut) {
      this.shortcuts.push(shortcut)
    },
    setShortcuts(shortcuts: Shortcut[]) {
      this.shortcuts = shortcuts
    },
  },
})
