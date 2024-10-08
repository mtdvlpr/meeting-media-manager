<!-- eslint-disable vue/no-unused-vars -->
<!-- Video in presentation mode -->
<template>
  <div :id="id">
    <div :id="id + '-container'" class="align-center d-flex" />
    <v-overlay
      absolute
      :value="changeTime"
      :opacity="1"
      class="d-flex justify-start"
    >
      <v-row style="max-width: 640px">
        <v-col align-self="start" class="d-flex flex-column px-0 ml-4">
          <form-timestamp
            v-model="clipped.start"
            :min="originalString.start"
            :max="clipped.end"
            @valid="validStart = $event"
          >
            <v-tooltip top>
              <template #activator="{ on }">
                <v-btn icon v-on="on" @click="resetClipped()">
                  <font-awesome-icon :icon="faRotateLeft" />
                </v-btn>
              </template>
              <span>{{ $t('videoTimeReset') }}</span>
            </v-tooltip>
          </form-timestamp>
          <form-timestamp
            v-model="clipped.end"
            :min="clipped.start"
            :max="originalString.end"
            @valid="validEnd = $event"
          >
            <v-tooltip bottom>
              <template #activator="{ on }">
                <v-btn
                  icon
                  :disabled="!validStart || !validEnd"
                  v-on="on"
                  @click="setTime()"
                >
                  <font-awesome-icon
                    :icon="faSquareCheck"
                    :class="`${
                      validStart && validEnd ? 'success' : 'error'
                    }--text`"
                  />
                </v-btn>
              </template>
              <span>{{ $t('videoTimeSet') }}</span>
            </v-tooltip>
          </form-timestamp>
        </v-col>
      </v-row>
    </v-overlay>
    <v-tooltip v-if="clickedOnce" right :value="true">
      <template #activator="data">
        <v-btn
          x-small
          absolute
          left
          tile
          depressed
          style="bottom: 4px"
          :class="{ 'pulse-danger': isClipped }"
          @click="atClick()"
        >
          <font-awesome-icon :icon="faFilm" pull="left" />
          {{
            (playing || isClipped) && !isShortVideo
              ? `${progress[0] ?? limits.start}/${limits.end}`
              : `${duration}`
          }}
        </v-btn>
      </template>
      <span>{{ $t('clickAgain') }}</span>
    </v-tooltip>
    <v-btn
      v-else
      x-small
      absolute
      left
      tile
      depressed
      style="bottom: 4px"
      :class="{ 'pulse-danger': isClipped }"
      @click="atClick()"
    >
      <font-awesome-icon :icon="faFilm" pull="left" />
      {{
        (playing || isClipped) && !isShortVideo
          ? `${progress[0] ?? limits.start}/${limits.end}`
          : `${duration}`
      }}
    </v-btn>
    <v-tooltip v-if="ccAvailable" right>
      <template #activator="{ on }">
        <v-btn
          x-small
          absolute
          tile
          depressed
          :style="`left: 123px; ${ccToggle ? 'top' : 'bottom'}: 4px`"
          v-on="on"
          @click="ccToggle = !ccToggle"
        >
          <font-awesome-icon :icon="ccIcon" />
        </v-btn>
      </template>
      <span>{{ $t('toggleSubtitlePosition') }}</span>
    </v-tooltip>
  </div>
</template>
<script lang="ts">
import { pathToFileURL } from 'url'
import { Duration } from 'dayjs/plugin/duration'
import { basename, changeExt } from 'upath'
// eslint-disable-next-line import/named
import { defineComponent, PropOptions } from 'vue'
import { ipcRenderer } from 'electron'
import {
  faSquareCheck,
  faRotateLeft,
  faFilm,
  faClosedCaptioning,
  IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import { faClosedCaptioning as farClosedCaptioning } from '@fortawesome/free-regular-svg-icons'
import { existsSync } from 'original-fs'
import { AUDIO_ICON, MS_IN_SEC, VIDEO_ICON } from '~/constants/general'
import { MeetingFile } from '~/types'
export default defineComponent({
  props: {
    src: {
      type: String,
      required: true,
    },
    playing: {
      type: Boolean,
      default: false,
    },
    ccEnable: {
      type: Boolean,
      default: true,
    },
    stream: {
      type: Boolean,
      default: false,
    },
    tempClipped: {
      type: Object,
      default: null,
    } as PropOptions<{ start: string; end: string }>,
  },
  data() {
    return {
      progress: [] as string[],
      clickedOnce: false,
      changeTime: false,
      ccAvailable: false,
      ccToggle: false,
      audioIcon: AUDIO_ICON,
      videoIcon: VIDEO_ICON,
      original: {
        start: 0,
        end: 0,
      },
      validStart: false,
      validEnd: false,
      clipped: {
        start: '0',
        end: '0',
      },
      current: 0,
    }
  },
  computed: {
    ccIcon(): IconDefinition {
      return this.ccEnable ? faClosedCaptioning : farClosedCaptioning
    },
    faRotateLeft() {
      return faRotateLeft
    },
    faSquareCheck() {
      return faSquareCheck
    },
    faFilm() {
      return faFilm
    },
    meetings(): Map<string, Map<number, MeetingFile[]>> {
      return this.$store.state.media.meetings as Map<
        string,
        Map<number, MeetingFile[]>
      >
    },
    url(): string {
      return (
        (this.stream ? this.src : pathToFileURL(this.src).href) +
        (this.thumbnail ? '' : '#t=5')
      )
    },
    thumbnail(): string | null {
      let thumbnail: string | null | undefined

      const meetingMedia = this.meetings.get(this.$route.query.date as string)
      if (!meetingMedia) return null

      meetingMedia.forEach((media) => {
        if (thumbnail !== undefined) return
        const file = media.find((m) => m.safeName === basename(this.src))
        if (file?.pub?.startsWith('sjj')) {
          thumbnail = null
        } else if (file) {
          thumbnail = file.thumbnail || file.trackImage || null
        }
      })

      return thumbnail ?? null
    },
    poster(): string {
      return this.$isVideo(this.src) ? this.videoIcon : this.audioIcon
    },
    id(): string {
      return this.$strip('video-' + basename(this.src))
    },
    duration(): string {
      return this.format(
        this.$dayjs.duration(this.clippedMs.end - this.clippedMs.start, 'ms')
      )
    },
    isShortVideo(): boolean {
      return this.duration === '00:00:00' || this.duration === '00:00'
    },
    limits(): { start: string; end: string } {
      return {
        start: this.format(this.$dayjs.duration(this.clippedMs.start, 'ms')),
        end: this.format(this.$dayjs.duration(this.clippedMs.end, 'ms')),
      }
    },
    originalString(): { start: string; end: string } {
      return {
        start: this.$dayjs
          .duration(this.original.start, 'ms')
          .format('HH:mm:ss.SSS'),
        end: this.$dayjs
          .duration(this.original.end, 'ms')
          .format('HH:mm:ss.SSS'),
      }
    },
    isClipped(): boolean {
      return !(
        this.original.start === this.clippedMs.start &&
        this.original.end === this.clippedMs.end
      )
    },
    clippedMs(): { start: number; end: number } {
      return {
        start: parseInt(
          this.$dayjs
            .duration({
              hours: parseInt(this.clipped.start.split(':')[0]),
              minutes: parseInt(this.clipped.start.split(':')[1]),
              seconds: parseInt(this.clipped.start.split(':')[2]),
              milliseconds: parseInt(this.clipped.start.split('.')[1]),
            })
            .asMilliseconds()
            .toFixed(0)
        ),
        end: parseInt(
          this.$dayjs
            .duration({
              hours: parseInt(this.clipped.end.split(':')[0]),
              minutes: parseInt(this.clipped.end.split(':')[1]),
              seconds: parseInt(this.clipped.end.split(':')[2]),
              milliseconds: parseInt(this.clipped.end.split('.')[1]),
            })
            .asMilliseconds()
            .toFixed(0)
        ),
      }
    },
  },
  watch: {
    playing(val: boolean) {
      if (val) {
        if (this.ccAvailable) {
          setTimeout(() => {
            this.toggleSubtitles(this.ccEnable, false)
          }, MS_IN_SEC)
        }
        ipcRenderer.on('videoProgress', (_e, progress) => {
          const percentage = (100 * MS_IN_SEC * progress[0]) / this.original.end
          this.progress = progress.map((seconds: number) => {
            return this.format(this.$dayjs.duration(seconds, 's'))
          })
          if (val) this.$emit('progress', percentage)
        })
      } else {
        this.current = 0
        this.progress = []
        if (this.tempClipped) {
          this.resetClipped()
          this.$emit('resetClipped')
        }
        ipcRenderer.removeAllListeners('videoProgress')
      }
    },
    ccToggle() {
      if (this.playing) {
        this.toggleSubtitles(this.ccEnable, true)
      }
    },
    ccEnable(val: boolean) {
      if (this.playing) {
        this.toggleSubtitles(val, false)
      }
    },
    tempClipped(val: { start: string; end: string }): void {
      if (val) {
        this.clipped = val
        this.setTime()
      }
    },
  },
  mounted(): void {
    this.setCCAvailable()
    const div = document.querySelector(`#${this.id}-container`)
    const source = document.createElement('source')
    source.src = this.url
    const video = document.createElement('video')
    video.width = 142
    video.height = 80
    video.preload = 'metadata'
    video.poster = this.thumbnail ?? this.poster
    video.appendChild(source)

    // When video has been loaded, set clipped to original
    video.onloadedmetadata = () => {
      this.original.end = parseInt(
        this.$dayjs.duration(video.duration, 's').asMilliseconds().toFixed(0)
      )
      this.clipped = {
        start: this.$dayjs
          .duration(this.original.start, 'ms')
          .format('HH:mm:ss.SSS'),
        end: this.$dayjs
          .duration(this.original.end, 'ms')
          .format('HH:mm:ss.SSS'),
      }
      this.$emit('clipped', {
        original: this.original,
        clipped: this.clippedMs,
        formatted: this.originalString,
      })
    }
    if (div) div.appendChild(video)
  },
  methods: {
    setCCAvailable() {
      this.ccAvailable =
        !!this.$getPrefs('media.enableSubtitles') &&
        existsSync(changeExt(this.src, '.vtt'))
    },
    toggleSubtitles(enabled: boolean, toggle = false) {
      ipcRenderer.send('toggleSubtitles', { enabled, toggle })
    },
    format(duration: Duration) {
      if (duration.hours() > 0) {
        return duration.format('HH:mm:ss')
      } else {
        return duration.format('mm:ss')
      }
    },
    atClick(): void {
      if (this.playing || this.isShortVideo) return
      if (this.clickedOnce) this.changeTime = true
      else {
        this.clickedOnce = true
        setTimeout(() => {
          this.clickedOnce = false
        }, 3 * MS_IN_SEC)
      }
    },
    setTime(): void {
      if (
        this.clippedMs.end < MS_IN_SEC ||
        this.clippedMs.end > this.original.end
      ) {
        this.resetClipped()
      } else {
        this.$emit('clipped', {
          original: this.original,
          clipped: this.clippedMs,
          formatted: this.clipped,
        })
      }
      this.changeTime = false
    },
    resetClipped(): void {
      this.clipped = JSON.parse(JSON.stringify(this.originalString))
      this.$emit('clipped', {
        original: this.original,
        clipped: this.clippedMs,
        formatted: this.clipped,
      })
      this.changeTime = false
    },
  },
})
</script>
