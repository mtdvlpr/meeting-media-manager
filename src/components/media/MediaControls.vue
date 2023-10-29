<template>
  <div>
    <v-dialog v-model="managingMedia" persistent fullscreen>
      <manage-media
        :media="localMedia"
        :loading="loading"
        @cancel="managingMedia = false"
      />
    </v-dialog>
    <v-row no-gutters class="media-controls">
      <!-- :media-active="mediaActive" -->
      <present-top-bar
        :current-index="currentIndex"
        :media-count="items.length"
        :custom-sort="customSort"
        @cc="ccEnable = !ccEnable"
        @previous="previous()"
        @next="next()"
        @reset-sort="customSort = false"
        @manage-media="managingMedia = true"
      />
      <v-expand-transition>
        <loading-icon v-if="loading" />
        <media-list
          v-else
          :items="items"
          :media-active="mediaActive"
          :zoom-part="zoomPart"
          :cc-enable="ccEnable"
          :custom-sort="customSort"
          :custom-sort-order="customSortOrder"
          @index="setIndex"
          @deactivate="resetDeactivate"
          @custom-sort="customSort = true"
        />
      </v-expand-transition>
    </v-row>
  </div>
</template>
<script setup lang="ts">
import { useIpcRenderer, useIpcRendererOn } from '@vueuse/electron'
import { useRouteQuery } from '@vueuse/router'
import { basename, dirname, join } from 'upath'
import * as fileWatcher from 'chokidar'
import { pathExistsSync, readJsonSync, readdirSync } from 'fs-extra'
import type { LocalFile } from '~~/types'

const loading = ref(false)

// Current meeting date
const date = useRouteQuery<string>('date', '')

// Subtitles
const ccEnable = ref(true)
provide(ccEnableKey, ccEnable)

// Manage media dialog
const managingMedia = ref(false)
const localMedia = computed((): LocalFile[] => [
  ...items.value
    .map((item) => {
      return {
        safeName: basename(item.path),
        filepath: item.path,
        isLocal: true,
      }
    })
    .sort((a, b) => {
      const nameA = a.safeName.toUpperCase()
      const nameB = b.safeName.toUpperCase()
      if (nameA < nameB) {
        return -1
      }
      if (nameA > nameB) {
        return 1
      }
      return 0
    })
    .reverse()
    .reduceRight((map, item) => {
      map.set(item.safeName, item)
      return map
    }, new Map())
    .values(),
])

// Get media files
type MediaItem = {
  id: string
  path: string
  play: boolean
  stop: boolean
  deactivate: boolean
}
const mPath = mediaPath()
const items = reactive(ref<MediaItem[]>([]))
const watchers = ref<fileWatcher.FSWatcher[]>([])
onBeforeUnmount(() => {
  watchers.value.forEach((watcher) => {
    watcher.close()
  })
})
onMounted(() => {
  if (pathExistsSync(join(mPath, date.value))) {
    items.value = readdirSync(join(mPath, date.value))
      .filter((file) => isImage(file) || isVideo(file) || isAudio(file))
      .map((file) => {
        const cleanName = sanitize(file, true)
        return {
          id: strip('mediaitem-' + cleanName),
          path: join(mPath, date.value, cleanName),
          play: false,
          stop: false,
          deactivate: false,
        }
      })
      .sort((a, b) => a.id.localeCompare(b.id))
  }

  customSortOrder.value = readJsonSync(
    join(mPath, date.value, 'file-order.json'),
    { throws: false },
  )

  watchers.value.push(
    fileWatcher
      .watch(join(mPath, date.value), {
        depth: 1,
        ignorePermissionErrors: true,
      })
      .on('add', (path, stats) => {
        if (isImage(path) || isVideo(path) || isAudio(path)) {
          const cleanName = sanitize(basename(path), true)
          const filename = basename(path)
          const fileId = strip('mediaitem-' + cleanName)
          if (filename !== cleanName) {
            rename(path, filename, cleanName)
          }
          if (!items.value.map((path) => path.id).includes(fileId)) {
            const newItem = {
              id: fileId,
              path: join(dirname(path), cleanName),
              play: false,
              stop: false,
              deactivate: false,
              size: stats?.size,
            }
            items.value = [...items.value, newItem].sort((a, b) =>
              a.id.localeCompare(b.id),
            )
          }
        }
      })
      .on('change', (path, stats) => {
        if (isImage(path) || isVideo(path) || isAudio(path)) {
          const cleanName = sanitize(basename(path), true)
          const index = items.value.findIndex((item) => {
            return item.id === strip(`mediaitem-${cleanName}`)
          })
          if (index !== -1) {
            items.value = items.value
              .map((item, i) => {
                if (i === index) {
                  return {
                    id: strip('mediaitem-' + cleanName),
                    path: join(dirname(path), cleanName),
                    play: false,
                    stop: false,
                    deactivate: false,
                    size: stats?.size,
                  }
                }
                return item
              })
              .sort((a, b) => a.id.localeCompare(b.id))
          }
        }
      })
      .on('unlink', (path) => {
        if (isImage(path) || isVideo(path) || isAudio(path)) {
          const index = items.value.findIndex((item) => {
            return (
              item.id === strip(`mediaitem-${sanitize(basename(path), true)}`)
            )
          })
          if (index !== -1) {
            items.value.splice(index, 1)
          }
        }
      }),
  )
  if (getPrefs('cloud.enable')) {
    // additional files
    watchers.value.push(
      fileWatcher
        .watch(join(getPrefs('cloud.path'), 'Additional', date.value), {
          depth: 1,
          ignorePermissionErrors: true,
        })
        .on('add', (additionalFile) => {
          if (
            isImage(additionalFile) ||
            isVideo(additionalFile) ||
            isAudio(additionalFile)
          ) {
            copy(
              additionalFile,
              join(mPath, date.value, sanitize(basename(additionalFile), true)),
            )
          }
        })
        .on('unlink', (additionalFile) => {
          rm(join(mPath, date.value, sanitize(basename(additionalFile), true)))
        }),
    )
    // hidden files
    watchers.value.push(
      fileWatcher
        .watch(join(getPrefs('cloud.path'), 'Hidden', date.value), {
          depth: 1,
          ignorePermissionErrors: true,
        })
        .on('add', (hiddenFile) => {
          rm(join(mPath, date.value, sanitize(basename(hiddenFile), true)))
        }),
    )
    // recurring files
    watchers.value.push(
      fileWatcher
        .watch(join(getPrefs('cloud.path'), 'Recurring'), {
          depth: 1,
          ignorePermissionErrors: true,
        })
        .on('add', (recurringFile) => {
          findAll(join(mPath, '*'), {
            onlyDirectories: true,
          }).forEach((dateFolder) => {
            if (
              isImage(recurringFile) ||
              isVideo(recurringFile) ||
              isAudio(recurringFile)
            ) {
              copy(
                recurringFile,
                join(dateFolder, sanitize(basename(recurringFile), true)),
              )
            }
          })
        })
        .on('unlink', (recurringFile) => {
          rm(findAll(join(mPath, '*', basename(recurringFile))))
        }),
    )
  }

  // Auto play first media item
  if (getPrefs<boolean>('media.autoPlayFirst')) {
    executeBeforeMeeting(
      'play',
      getPrefs<number>('media.autoPlayFirstTime'),
      () => {
        if (!mediaActive.value) {
          currentIndex.value = -1
          next()
        }
      },
    )
  }
})

// Media active state
const zoomPart = inject(zoomPartKey, ref(false))
const mediaActive = inject(mediaActiveKey, ref(false))
watch(mediaActive, (val) => {
  // Enable/disable nav
  useStatStore().setNavDisabled(val)

  // Reset playback state
  items.value.forEach((item) => {
    item.play = false
    item.stop = false
    item.deactivate = false
  })

  const mediaVisible = usePresentStore().mediaScreenVisible

  // Toggle Zoom spotlight
  const zoomStore = useZoomStore()
  const hostID = zoomStore.hostID
  if (zoomStore.client && !zoomPart.value && zoomStore.spotlights.length > 0) {
    toggleSpotlight(zoomSocket(), false)
    if (val && hostID) toggleSpotlight(zoomSocket(), true, hostID)
    zoomStore.spotlights.forEach((person) => {
      toggleSpotlight(zoomSocket(), true, person)
    })
    if (!val && mediaVisible) {
      useIpcRenderer().send('toggleMediaWindowFocus')
    }
  }

  // Toggle OBS scene
  const scene = useObsStore().currentScene
  const zoomScene = getPrefs<string>('app.obs.zoomScene')
  if (!val && scene) {
    setScene(zoomPart.value ? zoomScene || scene : scene)
  }

  // Toggle media window
  if (
    !val &&
    (zoomPart.value || getPrefs<boolean>('media.hideWinAfterMedia')) &&
    mediaVisible
  ) {
    useIpcRenderer().send('toggleMediaWindowFocus')
  }
})

// Media playback with shortcuts
const currentIndex = ref(-1)
useIpcRendererOn('play', (_e, type: 'next' | 'previous') => {
  if (type === 'next') {
    next()
  } else {
    previous()
  }
})
const customSort = ref(false)
const customSortOrder = ref()
const setIndex = (index: number) => {
  const previousItem = items.value[currentIndex.value] as MediaItem | undefined
  if (previousItem && currentIndex.value !== index) {
    previousItem.deactivate = true
  }
  currentIndex.value = index
}
const scrollToItem = (index: number) => {
  if (index >= 1) {
    const el = document.querySelector(`#${items.value[index - 1].id}`)
    if (el) el.scrollIntoView()
  } else {
    const el = document.querySelector('#media-list-container')
    if (el) el.scrollTo(0, 0)
  }
}
const previous = () => {
  if (mediaActive.value && currentIndex.value >= 0) {
    items.value[currentIndex.value].stop = true
  } else if (currentIndex.value > 0) {
    currentIndex.value--
    items.value[currentIndex.value].play = true
    scrollToItem(currentIndex.value)
  }
}
const next = () => {
  if (mediaActive.value && currentIndex.value >= 0) {
    items.value[currentIndex.value].stop = true
  } else if (currentIndex.value < items.value.length - 1) {
    currentIndex.value++
    items.value[currentIndex.value].play = true
    scrollToItem(currentIndex.value)
  }
}
const resetDeactivate = (index: number) => {
  items.value[index].deactivate = false
}
</script>
<style lang="scss" scoped>
.media-controls {
  max-width: 100%;
}
</style>
