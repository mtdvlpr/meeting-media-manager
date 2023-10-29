import { pathToFileURL } from 'url'
import { ipcRenderer, type IpcRendererEvent } from 'electron'
import { extname, join, basename, resolve } from 'upath'
import type { FadeOutType, VideoFile } from '~~/types'

export async function getSongs() {
  const store = useMediaStore()
  const result: VideoFile[] = await getMediaLinks({
    pubSymbol: store.songPub,
    format: 'MP4',
  })

  const fallbackLang = getPrefs<string>('media.langFallback')

  if (fallbackLang && result.length < NR_OF_KINGDOM_SONGS) {
    const fallback = await getMediaLinks({
      pubSymbol: store.songPub,
      format: 'MP4',
      lang: fallbackLang,
    })

    fallback.forEach((song) => {
      if (!result.find((s) => s.track === song.track)) {
        result.push(song)
      }
    })
    result.sort((a, b) => a.track - b.track)
  }

  result.forEach((song) => {
    song.safeName = sanitize(`- ${translate('song')} ${song.title}`) + '.mp4'
  })

  return result
}

export function autoStartMusic() {
  if (!getPrefs<boolean>('meeting.enableMusicButton')) return
  if (!getPrefs<boolean>('meeting.autoStartMusic')) return
  const meetingDay = isMeetingDay()
  if (!meetingDay) return

  const now = useNuxtApp().$dayjs()
  const autoStop = getPrefs<boolean>('meeting.enableMusicFadeOut')
  const stopType = getPrefs<FadeOutType>('meeting.musicFadeOutType')
  const fadeOutTime = autoStop
    ? getPrefs<number>('meeting.musicFadeOutTime')
    : 0
  const meetingTime = getPrefs<string>(`meeting.${meetingDay}StartTime`).split(
    ':',
  )

  const meetingStart = now
    .hour(+meetingTime[0])
    .minute(+meetingTime[1])
    .second(0)
    .millisecond(0)

  const timeToStop = meetingStart
    .subtract(1, 'm')
    .subtract(fadeOutTime, stopType === 'smart' ? 's' : 'm')
    .subtract(6, 's')

  if (now.isBetween(meetingStart.subtract(1, 'h'), timeToStop)) {
    shuffleMusic()
  }
}

interface LocalSong {
  title: string
  track: string
  path: string
}

export async function shuffleMusic(stop = false, immediately = false) {
  const store = useMediaStore()

  const onProgress = (_e: IpcRendererEvent, progress: number[]) => {
    if (useMediaStore().musicFadeOut && store.musicFadeOut) {
      const { $dayjs } = useNuxtApp()
      store.setMusicFadeOut(
        $dayjs.duration(progress[1] - progress[0], 's').format('mm:ss'),
      )
    }
  }

  if (stop) {
    if (store.songPub === 'sjjm') {
      const audio = document.querySelector<HTMLAudioElement>('#meetingMusic')

      if (!audio) return

      if (!immediately) {
        // Fade out audio
        const MS_TO_STOP = 3 * MS_IN_SEC // Let fadeout last 3 seconds
        const TOTAL_VOL = audio.volume
        while (audio.volume > 0) {
          audio.volume -= Math.min(audio.volume, (10 * TOTAL_VOL) / MS_TO_STOP)
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
      }
      audio.remove()
    } else {
      ipcRenderer.removeListener('videoProgress', onProgress)
      ipcRenderer.removeAllListeners('videoEnd')
      ipcRenderer.send('hideMedia')
    }

    store.setMusicFadeOut('')
  } else {
    if (getPrefs<boolean>('meeting.enableMusicFadeOut')) {
      const now = useNuxtApp().$dayjs()
      const fadeOutTime = getPrefs<number>('meeting.musicFadeOutTime')
      if (getPrefs<FadeOutType>('meeting.musicFadeOutType') === 'smart') {
        const day = isMeetingDay()

        if (day && !getPrefs<boolean>('meeting.specialCong')) {
          // Set stop time depending on mw or we day
          const meetingStarts = getPrefs<string | null>(
            `meeting.${day}StartTime`,
          )?.split(':') ?? ['0', '0']

          const timeToStop = now
            .hour(+meetingStarts[0])
            .minute(+meetingStarts[1])
            .second(0)
            .millisecond(0)
            .subtract(fadeOutTime, 's')
            .subtract(6, 's')

          if (timeToStop.isAfter(now)) {
            store.setMusicFadeOut(timeToStop)
          }
        }
      } else {
        store.setMusicFadeOut(now.add(fadeOutTime, 'm'))
      }
    }

    // Get songs from jw.org or from local cache
    const isOnline = useStatStore().online && !getPrefs<boolean>('app.offline')
    const signLanguage =
      store.songPub === 'sjj' &&
      getPrefs<boolean>('media.enableMediaDisplayButton')

    let songPub = 'sjjm'
    let mediaFormat = 'mp3'
    let mediaLang = 'E'

    if (signLanguage) {
      songPub = 'sjj'
      mediaFormat = 'mp4'
      mediaLang = getPrefs<string>('media.lang')
    }

    const songs: (VideoFile | LocalSong)[] = (
      isOnline
        ? (
            await getMediaLinks({
              pubSymbol: songPub,
              format: mediaFormat.toUpperCase(),
              lang: mediaLang,
            })
          ).filter((item) => extname(item.url) === `.${mediaFormat}`)
        : findAll(
            join(pubPath(), '..', mediaLang, songPub, '**', `*.${mediaFormat}`),
          ).map((item) => ({
            title: basename(item),
            track: basename(resolve(item, '..')),
            path: item,
          }))
    ).sort(() => 0.5 - Math.random())

    if (songs.length === 0) {
      warn('errorNoShuffleSongs')
    } else if (signLanguage) {
      playSignLanguageSong(songs, 0, !!store.musicFadeOut, isOnline)
      if (store.musicFadeOut) ipcRenderer.on('videoProgress', onProgress)
    } else {
      createAudioElement(songs, 0, !!store.musicFadeOut, isOnline)
    }
  }
}

async function playSignLanguageSong(
  songs: (VideoFile | LocalSong)[],
  index: number,
  fadeOut: boolean,
  isOnline: boolean,
) {
  if (!usePresentStore().mediaScreenVisible) {
    ipcRenderer.send('toggleMediaWindowFocus')
  }

  const store = useMediaStore()

  const path = isOnline
    ? await downloadIfRequired({ file: songs[index] as VideoFile })
    : (songs[index] as LocalSong).path

  ipcRenderer.send('showMedia', { src: path })

  if (!fadeOut) {
    store.setMusicFadeOut('00:00')
  }

  ipcRenderer.on('videoEnd', () => {
    ipcRenderer.removeAllListeners('videoEnd')
    playSignLanguageSong(
      songs,
      index < songs.length - 1 ? ++index : 0,
      fadeOut,
      isOnline,
    )
  })
}

async function createAudioElement(
  songs: (VideoFile | LocalSong)[],
  index: number,
  fadeOut: boolean,
  isOnline: boolean,
) {
  const store = useMediaStore()
  const audio = document.createElement('audio')
  audio.autoplay = true
  audio.id = 'meetingMusic'
  audio.setAttribute('track', songs[index]?.track.toString() ?? 'Unknown')
  audio.onended = () => {
    audio.remove()
    createAudioElement(
      songs,
      index < songs.length - 1 ? ++index : 0,
      fadeOut,
      isOnline,
    )
  }
  audio.oncanplay = () => {
    audio.volume = getPrefs<number>('meeting.musicVolume') / 100
    if (!fadeOut) {
      store.setMusicFadeOut('..:..')
    }
  }
  audio.ontimeupdate = () => {
    const { $dayjs } = useNuxtApp()
    const duration = $dayjs
      .duration(audio.duration - audio.currentTime, 's')
      .format('mm:ss')

    if (store.musicFadeOut && !fadeOut) {
      store.setMusicFadeOut(duration)
    }
  }

  const source = document.createElement('source')
  source.type = 'audio/mpeg'
  if (isOnline) {
    source.src = pathToFileURL(
      await downloadIfRequired({ file: songs[index] as VideoFile }),
    ).href
  } else {
    source.src = pathToFileURL(
      (songs[index] as LocalSong | undefined)?.path ?? '',
    ).href
  }
  audio.appendChild(source)
  document.body.appendChild(audio)
}
