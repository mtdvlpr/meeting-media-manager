const PREFS = {
  app: {
    autoOpenFolderWhenDone: false,
    autoQuitWhenDone: false,
    autoRunAtBoot: false,
    autoStartSync: false,
    congregationName: null,
    disableAutoUpdate: false,
    disableHardwareAcceleration: false,
    localAppLang: null,
    localOutputPath: null,
    obs: {
      enable: false,
      port: null,
      password: null,
      mediaScene: null,
      cameraScene: null,
      useV4: true,
    },
    offline: false,
    outputFolderDateFormat: 'YYYY-MM-DD',
    theme: 'system',
  },
  cong: {
    server: null,
    port: null,
    user: null,
    password: null,
    dir: null,
  },
  media: {
    enableMediaDisplayButton: false,
    enableMp4Conversion: false,
    enablePp: false,
    enableSubtitles: false,
    enableVlcPlaylistCreation: false,
    excludeLffImages: false,
    excludeTh: false,
    hideMediaLogo: false,
    hideWinAfterMedia: false,
    includePrinted: false,
    keepOriginalsAfterConversion: false,
    lang: null,
    langFallback: null,
    langSubs: null,
    langUpdatedLast: null,
    maxRes: '720p',
    mediaWinShortcut: 'Alt+Z',
    ppBackward: null,
    ppForward: null,
    preferredOutput: 'window',
    presentShortcut: 'Alt+D',
  },
  meeting: {
    enableMusicButton: false,
    enableMusicFadeOut: false,
    musicFadeOutTime: 5,
    musicFadeOutType: 'smart',
    musicVolume: 100,
    mwDay: null,
    mwStartTime: null,
    shuffleShortcut: 'Alt+K',
    specialCong: false,
    weDay: null,
    weStartTime: null,
  },
}

const ENUMS = {
  theme: ['system', 'light', 'dark'],
  musicFadeOutType: ['smart', 'timer'],
  outputFolderDateFormat: [
    'YYYY-MM-DD',
    'YYYY-MM-DD - dddd',
    'DD-MM-YYYY',
    'DD-MM-YYYY - dddd',
  ],
  maxRes: ['240p', '360p', '480p', '720p'],
}

const FORCABLE = [
  'app.congregationName',
  'app.obs.cameraScene',
  'app.obs.enable',
  'app.obs.mediaScene',
  'app.obs.password',
  'app.obs.port',
  'app.outputFolderDateFormat',
  'media.enableMediaDisplayButton',
  'media.enableMp4Conversion',
  'media.enablePp',
  'media.enableSubtitles',
  'media.enableVlcPlaylistCreation',
  'media.excludeLffImages',
  'media.excludeTh',
  'media.hideMediaLogo',
  'media.hideWinAfterMedia',
  'media.includePrinted',
  'media.keepOriginalsAfterConversion',
  'media.lang',
  'media.langFallback',
  'media.langSubs',
  'media.maxRes',
  'media.ppBackward',
  'media.ppForward',
  'media.preferredOutput',
  'meeting.enableMusicButton',
  'meeting.enableMusicFadeOut',
  'meeting.musicFadeOutTime',
  'meeting.musicFadeOutType',
  'meeting.musicVolume',
  'meeting.mwDay',
  'meeting.mwStartTime',
  'meeting.specialCong',
  'meeting.weDay',
  'meeting.weStartTime',
]

module.exports = {
  PREFS,
  ENUMS,
  FORCABLE,
}
