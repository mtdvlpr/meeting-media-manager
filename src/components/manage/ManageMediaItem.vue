<template>
  <v-hover>
    <template #default="{ isHovering, props: hoverProps }">
      <v-list-item
        link
        density="compact"
        v-bind="hoverProps"
        :active="item.isLocal === undefined"
        class="manage-item px-0"
        :disabled="item.loading"
      >
        <template #prepend>
          <v-avatar
            v-if="item.safeName"
            :color="
              item.congSpecific
                ? 'info'
                : item.isLocal === undefined || item.isLocal
                ? 'primary'
                : 'secondary'
            "
          >
            <v-img
              v-if="getPreview(item) && isHovering"
              cover
              :src="preview"
              alt="Preview image"
            />
            <v-icon v-else color="white">{{ typeIcon(item.safeName) }}</v-icon>
          </v-avatar>
        </template>
        <template #append>
          <template v-if="item.recurring">
            <v-tooltip :text="$t('recurringMediaItem')">
              <template #activator="{ props: attrs }">
                <v-icon
                  v-bind="attrs"
                  icon="i-mdi:calendar-sync"
                  class="mx-2"
                  color="secondary"
                ></v-icon>
              </template>
            </v-tooltip>
          </template>
          <v-btn
            v-else-if="(item.congSpecific || item.isLocal) && !item.hidden"
            icon="i-mdi:form-textbox"
            size="small"
            variant="text"
            aria-label="rename file"
            @click="emit('edit')"
          />
          <template v-if="getPrefs('cloud.enable')">
            <template v-if="item.isLocal !== undefined && !item.recurring">
              <template v-if="!item.isLocal">
                <v-btn
                  v-if="item.hidden"
                  icon="i-mdi:eye-off"
                  size="small"
                  variant="text"
                  @click="unhide(item)"
                />
                <v-btn
                  v-else
                  icon="i-mdi:eye"
                  size="small"
                  variant="text"
                  @click="hide(item)"
                />
              </template>
              <template v-else>
                <v-btn
                  color="red-lighten-1"
                  icon="i-mdi:delete"
                  variant="text"
                  size="small"
                  :loading="item.loading"
                  @click="remove(item)"
                />
              </template>
            </template>
          </template>
          <template
            v-else-if="!item.recurring && (item.isLocal || item.congSpecific)"
          >
            <v-tooltip
              v-if="clickedOnce"
              model-value
              @update:model-value="() => {}"
            >
              {{ $t('clickAgain') }}
              <template #activator="{ props: attrs }">
                <v-btn
                  color="red-lighten-1"
                  icon="i-mdi:delete"
                  variant="text"
                  :loading="item.loading"
                  v-bind="attrs"
                  @click="atClick(item)"
                />
              </template>
            </v-tooltip>
            <v-btn
              v-else
              color="red-lighten-1"
              icon="i-mdi:delete"
              variant="text"
              :loading="item.loading"
              @click="atClick(item)"
            />
          </template>
          <template v-else>
            <v-tooltip
              v-if="clickedOnce"
              model-value
              @update:model-value="() => {}"
            >
              {{ $t('clickAgain') }}
              <template #activator="{ props: attrs }">
                <v-btn
                  variant="text"
                  :color="
                    item.isLocal === undefined || item.hidden
                      ? 'success'
                      : 'warning'
                  "
                  :icon="
                    'i-mdi:' +
                    (item.isLocal === undefined
                      ? 'plus'
                      : item.hidden
                      ? 'check'
                      : 'minus') +
                    '-circle'
                  "
                  :loading="item.loading"
                  v-bind="attrs"
                  @click="atClick(item)"
                />
              </template>
            </v-tooltip>
            <v-btn
              v-else
              variant="text"
              :color="
                item.isLocal === undefined || item.hidden
                  ? 'success'
                  : 'warning'
              "
              :icon="
                'i-mdi:' +
                (item.isLocal === undefined
                  ? 'plus'
                  : item.hidden
                  ? 'check'
                  : 'minus') +
                '-circle'
              "
              :loading="item.loading"
              @click="atClick(item)"
            />
          </template>
        </template>
        <v-list-item-title
          v-if="item.isLocal === undefined"
          :class="{
            'text-decoration-line-through': item.ignored,
          }"
        >
          {{ prefix + ' ' + item.safeName }}
        </v-list-item-title>
        <v-list-item-title
          v-else
          :class="{
            'text-decoration-line-through': item.hidden,
          }"
        >
          {{ item.safeName }}
        </v-list-item-title>
      </v-list-item>
    </template>
  </v-hover>
</template>
<script setup lang="ts">
import { pathToFileURL } from 'url'
import { extname, join, normalize } from 'upath'
import type { LocalFile, MeetingFile } from '~~/types'

const props = defineProps<{
  date: string
  prefix: string
  item: MeetingFile | LocalFile
}>()
const emit = defineEmits<{
  refresh: []
  atClick: []
  edit: []
  remove: []
}>()
// Get media preview
const loading = ref(false)
const preview = ref('')
const { online } = useOnline()
const previewName = ref('')
const { client, contents } = storeToRefs(useCongStore())

const unhide = (item: MeetingFile | LocalFile) => {
  if (!item.filepath) return
  mv(
    normalize(item.filepath),
    normalize(item.filepath).replace(
      join(getPrefs('cloud.path'), 'Hidden'),
      normalize(mediaPath()!),
    ),
  )
  item.hidden = false
}

const hide = (item: MeetingFile | LocalFile) => {
  if (!item.filepath) return
  mv(
    normalize(item.filepath),
    normalize(item.filepath).replace(
      normalize(mediaPath()!),
      join(getPrefs('cloud.path'), 'Hidden'),
    ),
  )
  item.hidden = true
}

const remove = (item: MeetingFile | LocalFile) => {
  if (!item.filepath) return
  rm(
    normalize(item.filepath).replace(
      normalize(mediaPath()!),
      join(getPrefs('cloud.path'), 'Additional'),
    ),
  )
}

const getPreview = (item: MeetingFile | LocalFile) => {
  if (previewName.value === item.safeName) {
    return preview.value
  }
  preview.value = item.trackImage || item.thumbnail || ''
  if (preview.value && item.safeName) {
    previewName.value = item.safeName
    return preview.value
  }
  loading.value = true
  if (item.contents && item.safeName) {
    preview.value =
      `data:image/${extname(item.safeName)};base64,` +
      item.contents.toString('base64')
  } else if (item.filepath && isImage(item.filepath)) {
    preview.value = pathToFileURL(item.filepath).href
  } else if (online.value && item.url && isImage(item.url)) {
    if (client.value && item.congSpecific) {
      client.value.getFileContents(item.url).then((c) => {
        preview.value =
          `data:;base64,` +
          Buffer.from(new Uint8Array(c as ArrayBuffer)).toString('base64')
      })
    } else if (item.url) {
      preview.value = pathToFileURL(item.url).href
    }
  }
  loading.value = false
  previewName.value = item.safeName!
  return preview.value
}

// When clicking on a file
const { atClick, clickedOnce } = useClickTwice(() => {
  if (props.item.loading || props.item.isLocal === undefined) return
  emit('atClick')
  if (
    !props.item.recurring &&
    (props.item.isLocal || props.item.congSpecific)
  ) {
    emit('remove')
  } else {
    toggleVisibility(props.item)
  }
})

// Toggle visibility
const toggleVisibility = async (item: MeetingFile | LocalFile) => {
  const mediaMap = useMediaStore().meetings.get(props.date)
  if (mediaMap && (!item.isLocal || (item.recurring && item.congSpecific))) {
    for (const [, media] of mediaMap) {
      const match = media.find((m) => m.safeName === item.safeName)
      if (!match) continue
      if (client.value && online.value) {
        const hiddenPath = join(getPrefs<string>('cong.dir'), 'Hidden')
        const datePath = join(hiddenPath, props.date)
        const filePath = join(datePath, item.safeName)

        // Create hidden/date dir if not exists
        try {
          await createCongDir(hiddenPath)
        } catch (e: unknown) {
          error('errorWebdavPut', e, hiddenPath)
        }

        try {
          await createCongDir(datePath)
        } catch (e: unknown) {
          error('errorWebdavPut', e, datePath)
        }

        // Remove file if exists or add it if it doesn't
        if (contents.value.find(({ filename }) => filename === filePath)) {
          try {
            await client.value.deleteFile(filePath)
          } catch (e: any) {
            if (e.message.includes(LOCKED.toString())) {
              warn('errorWebdavLocked', { identifier: filePath })
            } else if (e.status !== NOT_FOUND) {
              error('errorWebdavRm', e, filePath)
            }
          }
        } else {
          await client.value.putFileContents(filePath, '')
        }
        await updateContent()
      }
      match.hidden = !match.hidden
      emit('refresh')
      return
    }
  }
}

// File type icon
const typeIcon = (filename: string) => {
  const ext = filename ? extname(filename).toLowerCase() : ''
  switch (ext) {
    case '.pdf':
      return 'i-mdi:file-pdf-box'
    case '.vtt':
      return 'i-mdi:closed-caption'
    case '.json':
    case '.xspf':
      return 'i-mdi:file-code'
    default:
      return isImage(filename)
        ? 'i-mdi:image'
        : isVideo(filename)
        ? 'i-mdi:movie-open'
        : isAudio(filename)
        ? 'i-mdi:headphones'
        : 'i-mdi:file-question'
  }
}
</script>
<style lang="scss" scoped>
.manage-item {
  &:hover {
    cursor: default;
  }
}
</style>
