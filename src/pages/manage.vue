<template>
  <manage-media
    :media="media"
    :loading="loading"
    upload-media
    @refresh="getExistingMedia()"
    @cancel="useRouter().back()"
  />
</template>
<script setup lang="ts">
import { existsSync, readdirSync } from 'fs-extra'
import { extname, join } from 'upath'
import type { DateFormat, LocalFile, MeetingFile } from '~~/types'

const { t } = useI18n()
const date = computed(() => useRoute().query.date as string)
useHead({
  title: computed(() =>
    date.value
      ? date.value === 'Recurring'
        ? t('recurring')
        : `Manage ${date.value}`
      : 'Manage Media',
  ),
})

const now = getNow()
const loading = ref(true)
const { online } = useOnline()
onBeforeUnmount(() => {
  if (useCongStore().client) {
    notify('dontForgetToGetMedia')
  }
})
const loadMedia = async () => {
  loading.value = true
  useStatStore().setNavDisabled(true)
  if (online.value) {
    await getMeetingData()
  } else {
    warn('errorOffline')
  }
  getExistingMedia()
  loading.value = false
  useStatStore().setNavDisabled(false)
}
onMounted(() => {
  loadMedia()
})

const { $dayjs } = useNuxtApp()
const getMeetingData = async () => {
  try {
    const day = $dayjs(
      date.value,
      getPrefs('app.outputFolderDateFormat') as string,
    )

    const meetingDay = isMeetingDay(day)
    if (meetingDay === 'mw') {
      await getMwMedia(date.value)
    } else if (meetingDay === 'we') {
      await getWeMedia(date.value)
    } else {
      return
    }

    createMediaNames()

    if (useCongStore().client) {
      updateContent()
    }
  } catch (e: unknown) {
    error('errorAdditionalMediaList', e)
  }
}

const media = ref<(MeetingFile | LocalFile)[]>([])
const getExistingMedia = () => {
  try {
    if (useCongStore().client && online.value) {
      const day = $dayjs(
        date.value,
        getPrefs<DateFormat>('app.outputFolderDateFormat'),
      )

      getCongMedia(
        day.isValid() ? day.startOf('week') : now.startOf('week'),
        now,
      )
    }

    const meetings = useMediaStore().meetings
    const localMedia: LocalFile[] = []
    const jwMedia: MeetingFile[] = []

    for (const [, media] of meetings.get(date.value) ?? []) {
      for (const m of media) {
        m.isLocal = false
      }
      jwMedia.push(...media)
    }

    // If jw media is already downloaded, set isLocal of jw media to true, else add local file to list
    const mPath = mediaPath()
    if (mPath) {
      const path = join(mPath, date.value)
      if (existsSync(path)) {
        readdirSync(path)
          .filter((f) => extname(f) !== '.title')
          .forEach((filename) => {
            const jwMatch = jwMedia.find(
              ({ safeName }) => safeName === filename,
            )
            if (jwMatch) {
              jwMatch.isLocal = true
            } else {
              localMedia.push({
                safeName: filename,
                isLocal: true,
                filepath: join(mPath, date.value, filename),
              })
            }
          })
      }
    }

    media.value = [...jwMedia, ...localMedia].sort((a, b) => {
      return a.safeName!.localeCompare(b.safeName!)
    })
  } catch (e: unknown) {
    error('errorAdditionalMediaList', e)
  }
}
</script>
