<template>
  <div id="media-win-container" ref="container">
    <div id="importedYearText" ref="yeartext" class="font-fallback loading" />
    <div
      id="importedYearTextLogoContainer"
      ref="ytLogo"
      style="display: none"
    />
    <div id="mediaDisplay" ref="mediaDisplay" />
    <div id="blackOverlay" ref="blackOverlay" />
    <div id="resizeOverlay" ref="resizeOverlay">
      <div id="dimensions" ref="dimensions" />
    </div>
  </div>
</template>
<script setup lang="ts">
import { pathToFileURL } from 'url'
import type { PanzoomObject } from '@panzoom/panzoom'
import { useIpcRendererOn } from '@vueuse/electron'
import { ipcRenderer } from 'electron'
import { basename, changeExt, join } from 'upath'
import { existsSync, readFileSync } from 'fs-extra'
import type { PrefStore } from '~~/types'

definePageMeta({ layout: 'media' })

const interval = ref<NodeJS.Timeout | null>(null)
const container = ref<HTMLDivElement | null>()
const mediaDisplay = ref<HTMLDivElement | null>()
const yeartext = ref<HTMLDivElement | null>()
const ytLogo = ref<HTMLDivElement | null>()
const blackOverlay = ref<HTMLDivElement | null>()
const resizeOverlay = ref<HTMLDivElement | null>()
const dimensions = ref<HTMLDivElement | null>()

onMounted(() => {
  initPanzoom()
  ipcRenderer.send('readyToListen')
})

// Media
useIpcRendererOn('startMediaDisplay', async (_e, prefs: PrefStore) => {
  if (yeartext.value) yeartext.value.innerHTML = ''
  const main = document.querySelector('main')
  if (main) main.style.background = 'black'
  log.debug('startMediaDisplay', prefs)
  withSubtitles.value = prefs.media.enableSubtitles && !!prefs.media.langSubs

  const bgImage = findOne(
    join(
      (await ipcRenderer.invoke('userData')) as string,
      `custom-background-image-${prefs.app.congregationName}*`,
    ),
  )

  if (bgImage) {
    try {
      const response = await $fetch.raw<BlobPart>(pathToFileURL(bgImage).href, {
        responseType: 'blob',
      })
      if (!response._data) throw new Error('No data')
      const file = new File([response._data], basename(bgImage), {
        type: response.headers.get('content-type') ?? undefined,
      })

      if (main) {
        main.style.background = `url(${URL.createObjectURL(
          file,
        )}) black center center / contain no-repeat`
      }
    } catch (e: unknown) {
      log.error(e)
      if (main) main.style.background = 'black'
      setYearText(prefs)
    }
  } else {
    setYearText(prefs)
  }
})

// Show media
interface Media {
  src: string
  stream?: boolean
  start?: string
  end?: string
}
useIpcRendererOn('showMedia', (_e, media: Media | null) => {
  log.debug('showMedia', media)
  try {
    transitionToMedia(media)
  } catch (e: unknown) {
    log.error('Error transitioning media', e)
    hideMedia()
    ipcRenderer.send('videoEnd')
  }
})

const transitionToMedia = async (media: Media | null) => {
  zoomEnabled.value = !!media && isImage(media.src)
  resizingDone()
  if (blackOverlay.value) blackOverlay.value.style.opacity = '1'
  await new Promise((resolve) => setTimeout(resolve, 4 * 100))

  panzoom.value?.reset({ animate: false })

  if (media) {
    loadMedia(media)
  } else if (mediaDisplay.value) {
    mediaDisplay.value.style.background = 'transparent'
  }
  if (blackOverlay.value) blackOverlay.value.style.opacity = '0'
}

const loadMedia = (media: Media) => {
  if (!mediaDisplay.value) return
  const video = document.createElement('video')
  try {
    const videos = document.querySelectorAll('video')

    // Remove all videos
    videos.forEach((video) => {
      video.pause()
      video.remove()
    })

    if (isVideo(media.src) || isAudio(media.src)) {
      let src = media.stream ? media.src : pathToFileURL(media.src).href

      // Set start and end times
      if (media.start || media.end) {
        src += `#t=${media.start || ''}${media.end ? ',' + media.end : ''}`
      }

      video.id = 'mediaVideo'
      video.autoplay = true
      video.controls = false
      video.src = src

      const subsPath = changeExt(media.src, 'vtt')

      if (withSubtitles.value && existsSync(subsPath)) {
        log.debug('Adding subtitles', subsPath)
        const track = document.createElement('track')
        track.kind = 'subtitles'
        track.src = pathToFileURL(subsPath).href
        track.default = true
        track.srclang = 'en' // Needs a valid srclang, but we don't use it
        video.appendChild(track)
      }

      // If the video is short (converted image), pause it, so it doesn't stop automatically
      video.oncanplay = () => {
        log.debug('canplay start')
        if (
          withSubtitles.value &&
          existsSync(subsPath) &&
          video.textTracks.length > 0
        ) {
          video.textTracks[0].mode = 'showing'
        }
        if (video.duration < 0.1) {
          video.classList.add('shortVideoPaused')
          video.pause()
        }
        log.debug('canplay end')
      }

      video.onplay = () => {
        interval.value = setInterval(() => {
          ipcRenderer.send('videoProgress', [video.currentTime, video.duration])
        }, 0.5 * MS_IN_SEC)
      }

      // If media is paused externally, stop the video
      video.onpause = async () => {
        if (interval.value) {
          clearInterval(interval.value)
        }
        if (
          !(
            video.classList.contains('manuallyPaused') ||
            video.classList.contains('shortVideoPaused')
          )
        ) {
          await hideMedia()
          ipcRenderer.send('videoEnd')
        } else {
          ipcRenderer.send('videoProgress', [video.currentTime, video.duration])
        }
      }
      video.onended = () => {
        if (interval.value) {
          clearInterval(interval.value)
        }
        ipcRenderer.send('videoEnd')
      }
      mediaDisplay.value.append(video)
      mediaDisplay.value.style.background = 'black'
    } else if (isImage(media.src)) {
      mediaDisplay.value.style.background = `url(${
        pathToFileURL(media.src).href
      }) black center center / contain no-repeat`
    }
  } catch (e: unknown) {
    log.error(e)
    video.pause()
    video.remove()
    if (isImage(media.src)) {
      transitionToMedia(null)
    } else {
      hideMedia()
      ipcRenderer.send('videoEnd')
    }
  }
}

// Hide media
useIpcRendererOn('hideMedia', () => hideMedia())
const hideMedia = async () => {
  const videos = document.querySelectorAll('video')

  // Animate out
  if (blackOverlay.value) blackOverlay.value.style.opacity = '1'
  setTimeout(() => {
    if (mediaDisplay.value) {
      mediaDisplay.value.style.background = 'transparent'
      videos.forEach((video) => {
        video.pause()
        video.remove()
      })
    }
    if (blackOverlay.value) blackOverlay.value.style.opacity = '0'
  }, 4 * 100)

  if (videos.length > 0) {
    const video = videos[0]
    const MS_TO_STOP = 4 * 100 // Let fadeout last 400ms
    const TOTAL_VOL = video.volume
    while (video.volume > 0) {
      video.volume -= Math.min(video.volume, (10 * TOTAL_VOL) / MS_TO_STOP)
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
  }
}

// Yeartext
const setYearText = (prefs: PrefStore) => {
  if (!yeartext.value) return

  try {
    loadYeartextString(prefs)
    loadYeartextFont()

    if (ytLogo.value) {
      if (prefs.media.hideMediaLogo) {
        ytLogo.value.setAttribute('style', 'display: none')
      } else {
        loadIconFont()
      }
    }
  } catch (e: unknown) {
    log.error(e)
  }
}

const loadYeartextFont = async () => {
  if (!yeartext.value) return
  const result = await loadFont('yeartext')
  if (result) {
    yeartext.value.classList.replace('font-fallback', 'font-native')
  }
  yeartext.value.classList.remove('loading')
}

const loadIconFont = async () => {
  if (!ytLogo.value) return
  const result = await loadFont('icon')
  if (result) {
    ytLogo.value.setAttribute('style', '')
    ytLogo.value.innerHTML = "<div id='importedYearTextLogo'></div>"
  } else {
    ytLogo.value.setAttribute('style', 'display: none')
  }
}

const loadYeartextString = async (prefs: PrefStore) => {
  if (!yeartext.value) return
  const preferredPath = await ytPath(prefs.media.lang ?? undefined)
  const fallbackPath = await ytPath(prefs.media.langFallback ?? undefined)
  let yeartextString: string | null = null

  if (preferredPath && existsSync(preferredPath)) {
    yeartextString = readFileSync(preferredPath, 'utf8')
  } else if (fallbackPath && existsSync(fallbackPath)) {
    yeartextString = readFileSync(fallbackPath, 'utf8')
  }

  yeartext.value.innerHTML = ''
  if (yeartextString && yeartextString.length > 0) {
    const root = document.createElement('div')
    root.innerHTML = yeartextString

    // For each element of the yeartext, add it as a paragraph
    for (let i = 0; i < root.children.length; i++) {
      const el = root.children.item(i)
      if (el?.tagName === 'P' && el.textContent && el.textContent.length > 0) {
        const newEl = document.createElement('p')
        newEl.innerText = el.textContent
        yeartext.value.append(newEl)
      }
    }
  }
}

// Video actions
useIpcRendererOn('playVideo', () => {
  const video = document.querySelector('video')
  if (!video) return
  video.classList.remove('manuallyPaused', 'shortVideoPaused')
  try {
    video.play()
  } catch (e: unknown) {
    log.error(e)
  }
})

useIpcRendererOn('pauseVideo', () => {
  const video = document.querySelector('video')
  if (!video) return
  video.classList.add('manuallyPaused')
  try {
    video.pause()
  } catch (e: unknown) {
    log.error(e)
  }
})

useIpcRendererOn('scrubVideo', (_e, timeAsPercent: number) => {
  const video = document.querySelector('video')
  if (!video) return
  video.currentTime = (video.duration * timeAsPercent) / 100
  ipcRenderer.send('videoProgress', [video.currentTime, video.duration])
})

// Subtitles
const withSubtitles = ref(false)
useIpcRendererOn(
  'toggleSubtitles',
  (_e, { enabled, toggle }: { enabled: boolean; toggle: boolean }) => {
    withSubtitles.value = enabled
    const video = document.querySelector('video')
    if (!video) return
    if (video.textTracks.length > 0) {
      video.textTracks[0].mode = enabled ? 'showing' : 'hidden'
      const cues = video.textTracks[0].cues
      if (cues) {
        for (let i = 0; i < cues.length; i++) {
          const cue = cues[i]
          const newLine =
            // @ts-expect-error
            +cue.line?.toString().replace('auto', '-1') * -1
          // @ts-expect-error
          cue.line = toggle ? newLine : 'auto'
        }
      }
    }
  },
)

// Zoom and pan feature
const zoomEnabled = ref(false)
const panzoom = ref<PanzoomObject | null>(null)
const initPanzoom = async () => {
  if (!mediaDisplay.value) return
  const { default: Panzoom } = await import('@panzoom/panzoom')
  panzoom.value = Panzoom(mediaDisplay.value, {
    animate: true,
    canvas: true,
    cursor: 'default',
    duration: MS_IN_SEC,
    minScale: 1,
  })
}
useIpcRendererOn('zoom', (_e, scale) => {
  zoom(scale)
})
useIpcRendererOn('resetZoom', () => {
  panzoom.value?.reset()
})
useIpcRendererOn('pan', (_e, { x, y }: { x: number; y: number }) => {
  if (panzoom.value && mediaDisplay.value) {
    panzoom.value.pan(
      mediaDisplay.value.clientWidth * x,
      mediaDisplay.value.clientHeight * y,
    )
  }
})

const zoom = (scale: number) => {
  if (!panzoom.value || !zoomEnabled.value) return

  if (scale === 1) {
    panzoom.value.reset()
  } else {
    panzoom.value.zoom(Math.max(scale, 1))
  }
}

// Resizing
useIpcRendererOn('windowResizing', (_e, size: number[]) => {
  resizingNow(size[0], size[1])
})
const resizingNow = (width: number, height: number) => {
  if (!resizeOverlay.value || !dimensions.value) return
  resizeOverlay.value.style.opacity = '1'
  dimensions.value.innerText = `${width}x${height}`
}
useIpcRendererOn('windowResized', () => {
  resizingDone()
})
const resizingDone = () => {
  if (!resizeOverlay.value) return
  resizeOverlay.value.style.opacity = '0'
}
</script>
<style lang="scss">
html,
body,
video,
#mediaDisplay,
#blackOverlay,
#resizeOverlay {
  margin: 0;
  height: 100%;
  width: 100%;
  overflow: hidden !important;
}

#importedYearText,
#mediaDisplay,
#blackOverlay,
#resizeOverlay {
  position: absolute;
  top: 0;
  left: 0;
}

#importedYearText,
#importedYearTextLogoContainer {
  z-index: 5;
}

#importedYearText {
  color: white;
  width: 100%;
  text-align: center;
  height: fit-content;
  margin: auto;
  bottom: 0;
  right: 0;
  font-size: 3.85vw;
  line-height: 1.95vw;
  font-weight: 800;

  &.font-fallback {
    font-family: 'NotoSerif', serif;
    letter-spacing: 0.05rem;
  }

  &.font-native {
    font-family: 'Wt-ClearText-Bold', 'NotoSerif', serif;
  }

  &.loading {
    visibility: hidden;
  }

  p {
    margin: 1em 0;
    padding: 0;
  }
}

#importedYearTextLogoContainer {
  font-family: JW-Icons;
  font-size: 16vh;
  position: absolute;
  bottom: 12vh;
  right: 14vh;
  color: black !important;
  line-height: normal !important;
  box-sizing: unset;
  background: rgba(255, 255, 255, 0.2);
  border: rgba(255, 255, 255, 0) 1.5vh solid;
  height: 12vh;
  width: 12vh;
  overflow: hidden;

  #importedYearTextLogo {
    margin: -2.5vh -2vh; // was -2 -1
  }
}

#mediaDisplay {
  background: transparent;
  z-index: 10;
}

#blackOverlay,
#resizeOverlay {
  background: black;
  opacity: 0;
}

#blackOverlay {
  z-index: 15;
  transition: opacity 0.4s;
}

#resizeOverlay {
  z-index: 25;
  transition: opacity 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;

  #dimensions {
    color: #084298;
    background-color: #cfe2ff;
    border-color: #b6d4fe;
    position: relative;
    padding: 1rem;
    border: 1px solid transparent;
    border-radius: 0.25rem;
    width: fit-content;
    height: fit-content;
    font: bold 4vw monospace;
  }
}

::cue {
  font-size: 115%;
}
</style>
