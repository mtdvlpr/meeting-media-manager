<template>
  <v-dialog
    v-if="edit"
    model-value
    max-width="700px"
    @click:outside="edit = null"
  >
    <v-card>
      <v-card-text>
        <v-text-field
          v-model="edit.newName"
          :suffix="edit.ext"
          :disabled="renaming"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          color="red"
          variant="text"
          aria-label="cancel"
          :disabled="renaming"
          @click="edit = null"
        >
          {{ $t('cancel') }}
        </v-btn>
        <v-btn
          :loading="renaming"
          color="blue-darken-1"
          variant="text"
          aria-label="save"
          @click="saveNewName()"
        >
          {{ $t('save') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
  <v-list v-if="mediaList.length > 0" density="compact">
    <manage-media-item
      v-for="item in mediaList"
      :key="item.safeName + (item.color ? item.color : '')"
      :date="date"
      :prefix="prefix"
      :item="item"
      @at-click="atClick(item)"
      @edit="editItem(item)"
      @remove="removeItem(item)"
      @refresh="atRefresh(item)"
    />
  </v-list>
  <p v-else class="px-4 text-center">
    {{ $t('noMedia') }}
  </p>
</template>
<script setup lang="ts">
import { extname, join, trimExt } from 'upath'
import type { LocalFile, MeetingFile, VideoFile } from '~~/types'

const props = defineProps<{
  media: (LocalFile | MeetingFile)[]
  date: string
  newFile: VideoFile | null
  newFiles: (LocalFile | VideoFile)[]
  prefix: string
  showInput?: boolean
}>()
const emit = defineEmits<{ (e: 'refresh'): void }>()
onMounted(() => {
  setMediaList()
})

watch(
  [
    () => props.media,
    () => props.newFiles,
    () => props.newFile,
    () => props.prefix,
  ],
  () => {
    setMediaList()
  },
  { deep: true },
)

// Set media list
const mediaList = ref<(MeetingFile | LocalFile)[]>([])
const setMediaList = () => {
  // If new files are being uploaded, add them to the list
  if (props.newFile || props.newFiles.length > 0) {
    const media = [...props.newFiles, ...props.media]
    if (props.newFile) {
      media.push(props.newFile)
    }
    mediaList.value = media
      .filter(Boolean)
      .map((m) => {
        m.color = 'warning'
        return m
      })
      .sort((a, b) => {
        return (
          (!!props.prefix && a.isLocal === undefined
            ? props.prefix + ' '
            : '') + a.safeName
        ).localeCompare(
          (!!props.prefix && b.isLocal === undefined
            ? props.prefix + ' '
            : '') + b.safeName,
          undefined,
          { numeric: true },
        )
      })
  } else {
    mediaList.value = [
      ...props.media.map((m) => {
        m.color = 'warning'
        return m
      }),
    ]
  }
}

// Rename file
interface Edit {
  safeName: string
  congSpecific: boolean
  ext: string
  newName: string
}
const renaming = ref(false)
const edit = ref<Edit | null>(null)
const { online } = useOnline()
const { client, contents } = storeToRefs(useCongStore())
const saveNewName = async () => {
  if (renaming.value) return
  if (!edit.value) return
  renaming.value = true
  const cleanName = sanitize(edit.value.newName + edit.value.ext, true)
  rename(
    join(mediaPath(), props.date, edit.value.safeName),
    edit.value.safeName,
    cleanName,
  )

  if (props.date === 'Recurring') {
    findAll(join(mediaPath(), '*', edit.value.safeName)).forEach((file) => {
      if (edit.value) {
        rename(file, edit.value.safeName, cleanName)
      }
    })
  }

  if (client.value && online.value && edit.value.congSpecific) {
    const dirPath = join(getPrefs<string>('cong.dir'), 'Media', props.date)
    if (!contents.value.find((c) => c.filename === join(dirPath, cleanName))) {
      await client.value.moveFile(
        join(dirPath, edit.value.safeName),
        join(dirPath, cleanName),
      )
    }
    await updateContent()
  }
  edit.value = null
  renaming.value = false
  emit('refresh')
}

const atClick = (item: MeetingFile | LocalFile) => {
  if (item.isLocal !== undefined) {
    item.loading = true
  } else {
    item.ignored = !item.ignored
  }
}

const atRefresh = (item: MeetingFile | LocalFile) => {
  item.loading = false
  emit('refresh')
}

// Select file for renaming
const editItem = (item: MeetingFile | LocalFile) => {
  edit.value = {
    safeName: item.safeName!,
    congSpecific: !!item.congSpecific,
    ext: extname(item.safeName!),
    newName: trimExt(item.safeName!),
  }
}

// Remove file
const removeItem = async (item: MeetingFile | LocalFile) => {
  item.loading = true
  mediaList.value.splice(mediaList.value.indexOf(item), 1)
  rm(join(mediaPath(), props.date, item.safeName))

  if (props.date === 'Recurring') {
    rm(findAll(join(mediaPath(), '*', item.safeName)))
  }

  // Remove item in cong server
  if (item.congSpecific && item.url && online.value && client.value) {
    try {
      await client.value.deleteFile(item.url)
    } catch (e: any) {
      if (e.message.includes(LOCKED.toString())) {
        warn('errorWebdavLocked', {
          identifier: item.url,
        })
      } else if (e.status !== NOT_FOUND) {
        error('errorWebdavRm', e, item.url)
      }
    }
    await updateContent()
  }
  item.loading = false
  emit('refresh')
}
</script>
