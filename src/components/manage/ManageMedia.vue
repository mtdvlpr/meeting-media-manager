<template>
  <manage-select-video
    :active="type === 'jwOrgVideo' && !jwFile"
    @cancel="type = 'custom'"
    @select="selectVideo"
  />
  <progress-bar :current="relativeDownloadProgress" :total="totalProgress" />
  <v-card class="manage-media">
    <v-card-title class="pa-0">
      <v-overlay :model-value="dropping" class="align-center justify-center">
        <v-chip variant="flat">{{ $t('dropFiles') }}</v-chip>
      </v-overlay>
      <v-tabs
        v-model="type"
        :disabled="loading || saving || processing"
        @update:model-value="reset()"
      >
        <v-tab v-for="tab in types" :key="tab.value" :value="tab.value">
          {{ tab.label }}
        </v-tab>
      </v-tabs>
      <v-row
        v-if="type && type !== 'jwOrgVideo'"
        no-gutters
        class="pa-4 align-center"
      >
        <song-picker
          v-if="type === 'song'"
          v-model="jwFile"
          :disabled="loading || saving || processing"
        />
        <publication-picker
          v-else-if="type === 'jwOrgPub'"
          v-model="jwOrgPub"
          :disabled="loading || saving || processing"
          @select="
            !isLoneJwpub ? addFiles() : addFiles(false, 'JWPUB', 'jwpub')
          "
        />
        <manage-select-file
          v-else
          :type="type"
          :files="files"
          :loading="loading || saving || processing"
          @remove="removeFile"
          @reset="reset()"
          @click="
            addFiles(
              type === 'custom',
              type === 'custom' ? '*' : type,
              type === 'custom' ? '*' : type.toUpperCase(),
            )
          "
        />
      </v-row>
      <v-row
        v-if="jwFile || files.length > 0"
        no-gutters
        class="pa-4 align-center"
      >
        <manage-media-prefix
          v-model="prefix"
          :loading="loading || saving || processing"
        />
      </v-row>
    </v-card-title>
    <v-divider />
    <v-card-text :style="`overflow-y: auto;${listHeight}`">
      <v-dialog v-if="files.length === 1" persistent :model-value="isLoneJwpub">
        <manage-select-document
          :file="files[0]"
          :set-progress="setProgress"
          @select="addMedia($event)"
          @empty="reset()"
        />
      </v-dialog>
      <loading-icon v-if="loading || saving || processing" />
      <template v-else>
        <manage-media-list
          :date="date"
          :new-file="jwFile"
          :new-files="files"
          :prefix="prefix"
          :media="media"
          :show-input="!!type && type !== 'jwOrgVideo'"
          :show-prefix="!!jwFile || files.length > 0"
          @refresh="emit('refresh')"
        />
      </template>
    </v-card-text>
    <v-divider />
    <v-card-actions>
      <v-btn
        :disabled="loading || saving || processing"
        color="error"
        variant="text"
        @click="cancel()"
      >
        {{ $t('cancel') }}
      </v-btn>
      <v-btn
        v-if="jwFile || files.length > 0"
        :loading="loading || saving || processing"
        color="success"
        variant="text"
        @click="saveFiles()"
      >
        {{ $t('save') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
<script setup lang="ts">
import { useRouteQuery } from '@vueuse/router'
import { ipcRenderer } from 'electron'

import { readFile, stat, writeJSON } from 'fs-extra'
import { basename, changeExt, extname, join } from 'upath'
import type {
  LocalFile,
  MeetingFile,
  MeetingFileBase,
  PlaylistItem,
  VideoFile,
} from '~~/types'

const props = defineProps<{
  loading?: boolean
  uploadMedia?: Boolean
  media: (MeetingFile | LocalFile)[]
}>()
const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'cancel'): void
}>()
// File prefix
const prefix = ref('')
const { t } = useI18n()

// Type of media to add
const types = [
  {
    label: t('custom'),
    value: 'custom',
  },
  {
    label: t('song'),
    value: 'song',
  },
  {
    label: t('selectVideo'),
    value: 'jwOrgVideo',
  },
  {
    label: t('selectPublication'),
    value: 'jwOrgPub',
  },
  {
    label: t('jwlplaylist'),
    value: 'jwlplaylist',
  },
]
const type = ref('custom')

// Add video from JW.org
const jwFile = ref<VideoFile | null>(null)
watch(jwFile, (val) => (prefix.value = val ? '00-00' : prefix.value))
const selectVideo = (video: VideoFile) => (jwFile.value = video)

const processing = ref(false)

// Add media from JW.org publication
const jwOrgPub = ref()
watch(jwOrgPub, async (val) => {
  if (val) {
    const jwpub = (
      await getMediaLinks({
        pubSymbol: val.pub,
        format: 'JWPUB',
      })
    )[0] as MeetingFileBase
    const store = useMediaStore()
    store.setProgress({
      key: jwpub.url,
      promise: downloadIfRequired({
        file: jwpub,
      }),
    })
    await store.progress.get(jwpub.url)
    files.value = [{ filepath: jwpub.cacheFile } as LocalFile]
  }
})

// Add media from JWPUB
const files = ref<(LocalFile | VideoFile)[]>([])
const isLoneJwpub = computed(
  () =>
    files.value.length === 1 &&
    extname(
      (files.value[0]?.filename ||
        files.value[0]?.filepath ||
        files.value[0]?.safeName)!,
    ).toLowerCase() === '.jwpub',
)
const addMedia = (media: LocalFile[]) => {
  files.value = media
}

const processPlaylist = async (filePath: string) => {
  processing.value = true
  const db = (await getDb({
    file: (await getZipContentsByExt(filePath, '.db', false)) ?? undefined,
  }))!
  const media = executeQuery(
    db,
    `SELECT Label, FilePath, MimeType, DocumentId, Track, IssueTagNumber, KeySymbol, MepsLanguage
        FROM PlaylistItem PI
          LEFT JOIN PlaylistItemLocationMap PILM ON PI.PlaylistItemId = PILM.PlaylistItemId
          LEFT JOIN Location L ON PILM.LocationId = L.LocationId
          LEFT JOIN PlaylistItemIndependentMediaMap PIIMM ON PI.PlaylistItemId = PIIMM.PlaylistItemId
          LEFT JOIN IndependentMedia IM ON PIIMM.IndependentMediaId = IM.IndependentMediaId`,
  ) as PlaylistItem[]

  const promises: Promise<void>[] = []
  // Get correct extension
  media
    .map((m) => {
      if (
        !extname(m.Label || '') ||
        (!isImage(m.Label || '') &&
          !isVideo(m.Label || '') &&
          !isAudio(m.Label || ''))
      ) {
        if (extname(m.FilePath ?? '')) {
          m.Label += extname(m.FilePath!)
        } else if (m.MimeType) {
          m.Label = m.Label + '.' + m.MimeType.split('/')[1]
        } else {
          m.Label += '.mp4'
        }
      }
      return m
    })
    .forEach((m, index) => {
      promises.push(processPlaylistItem(index, m, filePath))
    })
  await Promise.allSettled(promises)
  processing.value = false
}
const processPlaylistItem = async (
  index: number,
  m: PlaylistItem,
  filePath: string,
) => {
  console.log(m)

  if (m.FilePath) {
    files.value.push({
      safeName: `${(index + 1).toString().padStart(2, '0')} - ${sanitize(
        m.Label,
        true,
      )}`,
      contents:
        (await getZipContentsByName(filePath, m.FilePath, false)) ?? undefined,
    })
  } else {
    const mediaFiles = (await getMediaLinks({
      pubSymbol: m.KeySymbol,
      docId: m.DocumentId,
      track: m.Track,
      issue: m.IssueTagNumber,
      lang: m.MepsLanguage ? MEPS_IDS[m.MepsLanguage] : undefined,
    })) as VideoFile[]
    files.value.push(
      ...mediaFiles.map((f) => ({
        ...f,
        safeName: `${(index + 1).toString().padStart(2, '0')} - ${sanitize(
          `${f.title || ''}${extname(f.url || f.filepath || '')}`,
          true,
        )}`,
      })),
    )
  }
}

// Add local files
watch(files, (val) => (prefix.value = val.length > 0 ? prefix.value : ''))
const addFiles = async (multi = true, ...exts: string[]) => {
  if (exts.length === 0) {
    exts.push('*')
  }

  const properties = ['openFile']
  if (multi) properties.push('multiSelections')

  const result = await ipcRenderer.invoke('openDialog', {
    filters: [{ name: exts[0], extensions: exts }],
    properties,
  })

  if (result && !result.canceled) {
    if (type.value === 'jwlplaylist') {
      await processPlaylist(result.filePaths[0])
    } else {
      files.value = result.filePaths.map((file: string) => ({
        safeName: '- ' + sanitize(basename(file), true),
        filepath: file,
      }))
    }
  }
}
const removeFile = (index: number) => {
  files.value.splice(index, 1)
}

// Save files
const saving = ref(false)
watch(saving, (val) => {
  useStatStore().setNavDisabled(val)
})
const { online } = useOnline()
const date = useRouteQuery<string>('date', '')
const { client } = storeToRefs(useCongStore())
const saveFiles = async () => {
  saving.value = true
  try {
    const promises: Promise<void>[] = []
    const fileArray = [...files.value]
    if (jwFile.value) fileArray.push(jwFile.value)
    totalFiles.value = fileArray.length

    if (client.value && online.value && props.uploadMedia) {
      const mPath = join(getPrefs<string>('cong.dir'), 'Media')
      const datePath = join(mPath, date.value)

      try {
        await createCongDir(mPath)
      } catch (e: unknown) {
        error('errorWebdavPut', e, mPath)
      }

      try {
        await createCongDir(datePath)
      } catch (e: unknown) {
        error('errorWebdavPut', e, datePath)
      }
    }

    fileArray.forEach((file) => {
      promises.push(processFile(file))
    })

    await Promise.allSettled(promises)

    await convertUnusableFilesByDate(date.value)

    if (client.value && props.uploadMedia) await updateContent()
    emit('refresh')
  } catch (e: unknown) {
    error(
      'errorAdditionalMedia',
      e,
      files.value.map((f) => f.filepath || f.filename || f.safeName).join(', '),
    )
  } finally {
    reset()
    saving.value = false
  }
}

// Process single file
const processFile = async (file: LocalFile | VideoFile) => {
  if (!file.safeName || file.ignored) {
    increaseProgress()
    return
  }
  if (prefix.value) {
    file.safeName = prefix.value + ' ' + file.safeName
  }

  const congPromises: Promise<void>[] = []
  const path = join(
    getPrefs('cloud.enable')
      ? join(getPrefs('cloud.path'), 'Additional')
      : mediaPath(),
    date.value,
    file.safeName,
  )

  // JWPUB extract
  if (file.contents) {
    write(path, file.contents)
  }
  // Local file
  else if (file.filepath) {
    await copy(file.filepath, path)
  }
  // Dropped file object (from web browser for example)
  else if (file.objectUrl) {
    await fetchFile({ url: file.objectUrl, dest: path })
  }
  // External file from jw.org
  else if (file.safeName) {
    file.folder = date.value
    await downloadIfRequired({
      file: file as VideoFile,
      additional: true,
    })

    if (file.subtitles) {
      congPromises.push(uploadFile(changeExt(path, 'vtt')))
    }

    // Download markers if required
    if (file.markers && file.folder && file.safeName) {
      const markers = Array.from(
        new Set(
          file.markers.markers.map(
            ({ duration, label, startTime, endTransitionDuration }) =>
              JSON.stringify({
                duration,
                label,
                startTime,
                endTransitionDuration,
              }),
          ),
        ),
      ).map((m) => JSON.parse(m))

      const markerPath = join(
        getPrefs('cloud.enable')
          ? join(getPrefs('cloud.path'), 'Additional')
          : mediaPath(),
        file.folder,
        changeExt(file.safeName, 'json'),
      )
      try {
        await writeJSON(markerPath, markers)
      } catch (error) {
        log.error(error)
      }
      congPromises.push(uploadFile(markerPath))
    }
  }

  // Upload media to the cong server
  if (client.value && online.value && props.uploadMedia) {
    const perf: any = {
      start: performance.now(),
      bytes: (await stat(path)).size,
      name: file.safeName,
    }

    congPromises.push(uploadFile(path))
    await Promise.allSettled(congPromises)

    perf.end = performance.now()
    perf.bits = perf.bytes * BITS_IN_BYTE
    perf.ms = perf.end - perf.start
    perf.s = perf.ms / MS_IN_SEC
    perf.bps = perf.bits / perf.s
    perf.MBps = perf.bps / BYTES_IN_MB
    perf.dir = 'up'
    log.debug('perf', perf)
  }
  increaseProgress()
}

// Upload file to cong server
const uploadFile = async (path: string) => {
  if (!client.value || !online.value || !props.uploadMedia) return
  const filePath = join(
    getPrefs<string>('cong.dir'),
    'Media',
    date.value,
    basename(path),
  )

  try {
    await client.value.putFileContents(filePath, await readFile(path), {
      overwrite: true,
      onUploadProgress: ({ loaded, total }) => {
        setProgress(loaded, total)
      },
    })
  } catch (e: any) {
    if (
      e.message === 'Cannot create a string longer than 0x1fffffe8 characters'
    ) {
      warn('errorWebdavTooBig', { identifier: basename(path) })
    } else {
      error('errorWebdavPut', e, `${basename(path)}`)
    }
  }
}

// Show progress
const processedFiles = ref(0)
const totalFiles = ref(0)
const { totalProgress, relativeDownloadProgress, setProgress } = useProgress()
const increaseProgress = () => {
  processedFiles.value++
  setProgress(processedFiles.value, totalFiles.value, true)
}

// Reset values
const reset = (resetTypeToo?: boolean) => {
  jwFile.value = null
  files.value = []
  if (resetTypeToo) type.value = 'custom'
  processedFiles.value = 0
  totalFiles.value = 0
}

// Cancel adding media
const cancel = () => {
  emit('cancel')
  reset(true)
}

// Drag and drop
const dropping = ref(false)
document.addEventListener('dragover', (e) => {
  e.preventDefault()
  e.stopPropagation()
  dropping.value = true
  reset(true)
})
document.addEventListener('dragleave', (e) => {
  e.preventDefault()
  e.stopPropagation()
  dropping.value = false
})
document.addEventListener('drop', (event) => {
  event.preventDefault()
  event.stopPropagation()
  if (event.dataTransfer?.files) {
    files.value = Array.from(event.dataTransfer.files).map((item) => {
      return {
        safeName: '- ' + sanitize(basename(item.name), true),
        objectUrl: URL.createObjectURL(item),
        filepath: item.path,
      } as LocalFile
    })
  }
  dropping.value = false
})

// List height
const windowSize = inject(windowSizeKey, { width: ref(0), height: ref(0) })
const listHeight = computed(() => {
  const TOOLBAR = 48
  const INPUT = 72
  const PREFIX = 72
  const EL_PADDING = 2
  const FOOTER = 52
  let otherElements = FOOTER + TOOLBAR + EL_PADDING
  if (!!type.value && !type.value.includes('jwOrg')) {
    otherElements += INPUT
  }
  if (!!jwFile.value || files.value.length > 0) {
    otherElements += PREFIX
  }
  const height = windowSize.height.value - otherElements
  return `height: ${height}px;`
})
</script>
