<template>
  <v-card>
    <v-card-title style="word-break: break-word" class="justify-center">
      {{
        !loading && missingMedia.length > 0
          ? $t('selectExternalMedia')
          : $t('selectDocument')
      }}
    </v-card-title>
    <v-card-text>
      <loading-icon v-if="loading" />
      <v-list v-else-if="missingMedia.length > 0">
        <template v-for="item in missingMedia" :key="item">
          <v-list-item class="text-center" @click="uploadMissingFile(item)">
            <v-list-item-title>{{ item }}</v-list-item-title>
          </v-list-item>
          <v-divider />
        </template>
      </v-list>
      <v-list v-else style="max-height: 300px; overflow-y: auto">
        <template v-for="item in items" :key="item.DocumentId">
          <v-list-item class="text-center" @click="selectDoc(item.DocumentId)">
            <v-list-item-title>{{ item.Title }}</v-list-item-title>
          </v-list-item>
          <v-divider />
        </template>
      </v-list>
    </v-card-text>
    <v-card-actions v-if="!loading">
      <v-spacer />
      <v-btn color="error" @click="emit('empty')">Cancel</v-btn>
      <v-spacer />
      <v-btn
        v-if="missingMedia.length > 0"
        color="primary"
        variant="flat"
        @click="finish()"
      >
        Save
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
<script setup lang="ts">
import { ipcRenderer } from 'electron'
import type { Database } from '@stephen/sql.js'
import { extname, trimExt } from 'upath'
import type { LocalFile, VideoFile } from '~~/types'

const props = defineProps<{
  file: LocalFile | VideoFile
  setProgress?: (loaded: number, total: number, global?: boolean) => void
}>()

const emit = defineEmits<{
  (e: 'empty'): void
  (e: 'select', files: LocalFile[]): void
}>()

const loading = ref(true)

// Select first if only one, warn if none
onMounted(() => {
  getDocuments().then(() => {
    if (items.value.length === 0) {
      warn('warnNoDocumentsFound')
      emit('empty')
    } else if (items.value.length === 1) {
      selectDoc(items.value[0].DocumentId)
    }
  })
})

// Fetch available documents from jwpub file
const db = ref<Database | null>(null)
const items = ref<{ DocumentId: number; Title: string }[]>([])
const getDocuments = async () => {
  loading.value = true
  const database = await getDbFromJWPUB({
    localPath: props.file.filepath,
  })
  if (!database) return
  db.value = database

  const table =
    executeQuery(
      database,
      "SELECT * FROM sqlite_master WHERE type='table' AND name='DocumentMultimedia'",
    ).length === 0
      ? 'Multimedia'
      : 'DocumentMultimedia'
  const suppressZoom = executeQuery<{ CNT_REC: number }>(
    database,
    "SELECT COUNT(*) AS CNT_REC FROM pragma_table_info('Multimedia') WHERE name='SuppressZoom'",
  ).map((item) => {
    return item.CNT_REC > 0
  })[0]

  items.value = executeQuery<{ DocumentId: number; Title: string }>(
    database,
    `SELECT DISTINCT ${table}.DocumentId, Document.Title 
    FROM Document 
      INNER JOIN ${table} ON Document.DocumentId = ${table}.DocumentId
      ${
        table === 'DocumentMultimedia'
          ? `INNER JOIN Multimedia ON Multimedia.MultimediaId = ${table}.MultimediaId`
          : ''
      }
    WHERE Multimedia.CategoryType <> 9
    ${suppressZoom ? 'AND Multimedia.SuppressZoom = 0' : ''}
    ORDER BY ${table}.DocumentId`,
  )
  loading.value = false
}

// Select a document and load media
const docId = ref(0)
const mediaFiles = ref<LocalFile[]>([])
watch(
  mediaFiles,
  () => {
    if (!loading.value && missingMedia.value.length === 0) {
      finish()
    }
  },
  { deep: true },
)
const selectDoc = async (id: number) => {
  loading.value = true
  docId.value = id

  try {
    // Get media from jwpub file
    const mmItems = await getDocumentMultiMedia(
      db.value!,
      id,
      undefined,
      undefined,
      true,
      true,
    )
    for (const [i, mm] of mmItems.entries()) {
      if (props.setProgress) props.setProgress(i + 1, mmItems.length)
      const {
        Label,
        Caption,
        FilePath,
        KeySymbol,
        Track,
        IssueTagNumber,
        MimeType,
        CategoryType,
      } = mm.queryInfo ?? {}

      const prefix = (i + 1).toString().padStart(2, '0')
      const type = MimeType
        ? MimeType.includes('video')
          ? '.mp4'
          : '.mp3'
        : ''

      const title =
        mm.title ||
        Label ||
        Caption ||
        trimExt(FilePath ?? '') ||
        [KeySymbol, Track, IssueTagNumber].filter(Boolean).join('_')

      const ext = FilePath ? extname(FilePath) : type
      const name = sanitize(title, true) + ext

      const tempMedia: LocalFile = {
        safeName: `${prefix} - ${name}`,
        filename: name,
      }

      if (FilePath && CategoryType && CategoryType !== -1) {
        tempMedia.contents =
          (await getZipContentsByName(props.file.filepath!, FilePath)) ??
          undefined
      } else if (mm.url) {
        Object.assign(tempMedia, mm)
      } else {
        missingMedia.value.push(tempMedia.filename!)
      }
      mediaFiles.value.push(tempMedia)
    }
    loading.value = false
  } catch (e) {
    log.error(e)
    loading.value = false
    finish()
  }
}

// Add missing media from local path
const missingMedia = ref<string[]>([])
const uploadMissingFile = async (name: string) => {
  const result = await ipcRenderer.invoke('openDialog', {
    title: name,
    filters: [{ name, extensions: [extname(name).substring(1)] }],
    properties: ['openFile'],
  })
  if (result && !result.canceled) {
    missingMedia.value = missingMedia.value.filter((f) => f !== name)
    const find = mediaFiles.value.find((f) => f.filename === name)
    if (find) find.filepath = result.filePaths[0]
  }
}

// Emit selected media
const finish = () => {
  emit(
    'select',
    mediaFiles.value
      .filter((m) => !missingMedia.value.includes(m.filename!))
      .sort((a, b) => a.safeName!.localeCompare(b.safeName!)),
  )
}
</script>
