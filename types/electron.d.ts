import type { Display, Point } from 'electron'

export interface Screen extends Display {
  humanFriendlyNumber: number
}

export interface ScreenInfo {
  displays: Screen[]
  winMidpoints: { main?: Point; media?: Point }
  winCoordinates: { main?: Point; media?: Point }
  otherScreens: Screen[]
}

export interface MediaWinOptions {
  destination: number | null
  type: 'window' | 'fullscreen'
}

export type ShortcutAction =
  | 'toggleMediaWindow'
  | 'openPresentMode'
  | 'toggleMusicShuffle'
  | 'setObsScene'
  | 'previousMediaItem'
  | 'nextMediaItem'
export type ShortcutScope = 'music' | 'present' | 'obs' | 'mediaWin'

export interface Shortcut {
  key: string
  fn: ShortcutAction
  scope?: ShortcutScope
}
