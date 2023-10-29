<template>
  <v-footer app class="settings-footer justify-space-between">
    <v-col cols="12" align-self="end" class="d-flex">
      <v-col class="d-flex pa-0 align-center" align-self="center">
        <v-btn
          :color="updateSuccess ? undefined : 'error'"
          :class="{ 'mr-2': true, 'pulse-danger': !updateSuccess }"
          @click="openReleases()"
        >
          <v-icon
            v-if="!updateSuccess"
            icon="i-mdi:hand-pointing-right"
            class="mr-1"
          />
          M³ {{ isDev ? 'dev' : version }}
        </v-btn>
        <v-btn class="mr-2" @click="report()">
          <v-tooltip activator="parent" location="top">
            {{ $t('reportIssue') }}
          </v-tooltip>
          <v-icon icon="i-mdi:bug" />
        </v-btn>
        <v-btn
          v-click-outside="() => (cacheColor = 'warning')"
          :color="cacheColor"
          :loading="loading"
          @click="removeCache()"
        >
          <v-icon icon="i-mdi:file-image-remove" color="black" start />
          {{ `${cache}MB` }}
          <v-tooltip
            v-if="cacheColor === 'warning'"
            activator="parent"
            location="top"
          >
            {{ $t('cleanCache') }}
          </v-tooltip>
          <v-tooltip
            v-else
            activator="parent"
            model-value
            location="top"
            @update:model-value="() => {}"
          >
            {{ $t('clickAgain') }}
          </v-tooltip>
        </v-btn>
      </v-col>
      <v-col align-self="end" class="text-right pa-0">
        <icon-btn
          v-if="cancel && isNew && !valid"
          variant="cancel"
          @click="goBack()"
        />
      </v-col>
    </v-col>
  </v-footer>
</template>
<script setup lang="ts">
import { useRouteQuery } from '@vueuse/router'
import { remove } from 'fs-extra'
import { join } from 'upath'
import getFolderSize from 'get-folder-size'
import type { PrefStore } from '~~/types'

const props = defineProps<{
  cache: number
  mounting: boolean
  valid: boolean
  refresh: boolean
  prefs: PrefStore
}>()

const emit = defineEmits<{
  cache: [cache: number]
}>()

const isNew = useRouteQuery<string>('new', '')
const cancel = ref(false)
const { version, isDev } = useRuntimeConfig().public

// Links
const report = () => window.open(bugURL(), '_blank')
const { updateSuccess } = storeToRefs(useStatStore())
const openReleases = () => {
  const { repo, version } = useRuntimeConfig().public
  window.open(
    `${repo}/releases/${updateSuccess.value ? 'tag/' + version : ''}`,
    '_blank',
  )
}

const cong = useRouteQuery('cong', '')
const goBack = async () => {
  log.debug('Go back')
  await remove(join(appPath(), `prefs-${cong.value}.json`))
  useStatStore().setNavDisabled(false)
  useRouter().back()
}

const setCancel = async () => {
  let congs = await getCongPrefs()
  congs = congs.filter(
    (c) => c.path !== join(appPath(), `prefs-${cong.value}.json`),
  )
  cancel.value = congs.length > 0
}

onMounted(() => {
  calcCache()
  setCancel()
})

// Cache
watch(
  () => props.refresh,
  () => calcCache(),
)
const shuffleMusicFiles = ref('')
const isSignLanguage = () => useMediaStore().mediaLang?.isSignLanguage
const setShuffleMusicFiles = () => {
  const pPath = pubPath()
  if (!pPath || !props.prefs.media.lang) return
  shuffleMusicFiles.value = isSignLanguage()
    ? join(pPath, '..', props.prefs.media.lang, 'sjj', '**', '*.mp4')
    : props.prefs.media.lang === 'E'
    ? ''
    : join(pPath, '..', 'E', 'sjjm', '**', '*.mp3')
}

const calcCache = async () => {
  loading.value = true
  setShuffleMusicFiles()
  let size = 0
  if (props.prefs.app.localOutputPath || props.prefs.media.lang) {
    const folders = getCacheFolders()

    for (const folder of folders) {
      try {
        size +=
          (await getFolderSize.loose(folder, { ignore: /Recurring/ })) /
          1000 /
          1000
      } catch (e) {
        log.error(folder, e)
      }
    }
  }
  emit('cache', parseFloat(size.toFixed(1)))
  loading.value = false
}

const getCacheFolders = (onlyDirs = false) => {
  const folders: string[] = []
  const pPath = pubPath()
  const mPath = mediaPath()
  const mediaLang = props.prefs.media.lang
  if (mPath) folders.push(join(mPath, '..', mediaLang, onlyDirs ? '*' : ''))
  if (pPath) {
    folders.push(join(pPath, '..', mediaLang))
    if (!onlyDirs && shuffleMusicFiles.value) {
      folders.push(...findAll(shuffleMusicFiles.value))
    }
    const fallbackLang = props.prefs.media.langFallback
    if (fallbackLang) {
      const fallbackDir = join(pPath, '..', fallbackLang)
      folders.push(fallbackDir)
    }
  }
  return folders
}

const { online } = useOnline()
const loading = ref(false)
const cacheColor = ref('warning')
const removeCache = async () => {
  if (cacheColor.value === 'warning') {
    cacheColor.value = 'error'
    setTimeout(() => {
      cacheColor.value = 'warning'
    }, 3 * MS_IN_SEC)
  } else {
    loading.value = true

    const mPath = mediaPath()
    if (mPath && shuffleMusicFiles.value) rm(findAll(shuffleMusicFiles.value))
    const folders = getCacheFolders(true)
    rm(
      findAll(folders, {
        ignore: mPath ? [join(mPath, 'Recurring')] : [],
        onlyDirectories: true,
      }),
    )

    if (online.value) {
      await Promise.allSettled([getJWLangs(), getYearText()])
    }
    cacheColor.value = 'warning'
    calcCache()

    useMediaStore().clear()
    useDbStore().clear()

    loading.value = false
  }
}
</script>
