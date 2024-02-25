<template>
  <v-dialog :model-value="active" @click:outside="emit('cancel')">
    <v-sheet class="pa-2">
      <h2 class="text-center">{{ $t('selectVideo') }}</h2>
      <v-text-field
        v-model="searchQuery"
        :label="`Search through all ${allVideos.length} videos`"
        clearable
      />
      <loading-icon v-if="loading" />
      <v-row v-else style="width: 100%" class="ma-0">
        <template v-for="video in filteredVideos" :key="video.guid">
          <template v-if="filteredVideos.length > 30">
            <v-lazy :options="{ threshold: 0.5 }">
              <v-chip class="me-1 mb-1" @click="selectVideo(video)">
                {{ video.title }}
              </v-chip>
            </v-lazy>
          </template>
          <v-col v-else sm="4" md="3" lg="2">
            <v-card
              hover
              ripple
              aspect-ratio="16 / 9"
              rounded
              @click="selectVideo(video)"
            >
              <v-img
                :src="getVideoImg(video.images)"
                aspect-ratio="16 / 9"
                class="text-white align-end"
                gradient="to bottom, rgba(0,0,0,.1), rgba(0,0,0,.5)"
              >
                <v-card-title style="word-break: normal; user-select: none">
                  {{ video.title }}
                </v-card-title>
              </v-img>
            </v-card>
          </v-col>
        </template>
      </v-row>
    </v-sheet>
  </v-dialog>
</template>
<script setup lang="ts">
import { extname } from 'upath'
import type { Images, MediaItem, VideoFile } from '~~/types'

defineProps<{
  active: boolean
}>()

const emit = defineEmits<{
  cancel: []
  select: [video: VideoFile]
}>()

onMounted(() => {
  getVideos()
})
const latestCategories = [
  'FeaturedLibraryLanding',
  'FeaturedLibraryVideos',
  'LatestVideos',
]
const allCategories = [
  // 'FeaturedLibraryLandingUnpubLangs',
  'GovtOfficialVideos',
  'VODConvMusic',
  'VODStudio',
  'VODChildren',
  'VODTeenagers',
  'VODFamily',
  'VODProgramsEvents',
  'VODOurActivities',
  'VODMinistry',
  'VODOurOrganization',
  'VODBible',
  'VODMovies',
  'VODSeries',
  'VODMusicVideos',
  'VODIntExp',
  'VODAudioDescriptions',
]
const loading = ref(false)
const videos = ref<MediaItem[]>([])
const latestVideos = ref<MediaItem[]>([])
const allVideos = ref<MediaItem[]>([])
const getVideos = async () => {
  loading.value = true
  try {
    latestVideos.value = await getLatestJWMedia(latestCategories)
    videos.value = latestVideos.value
    loading.value = false
    allVideos.value = await getLatestJWMedia(allCategories)
  } catch (e: unknown) {
    log.error(e)
  } finally {
    loading.value = false
  }
}

const getVideoImg = (images: Images) => {
  const { lss, lsr, sqr } = images
  return lss?.lg ?? lsr?.lg ?? lss?.xl ?? lsr?.xl ?? sqr?.lg ?? sqr?.xl ?? ''
}

const selectVideo = (video: MediaItem) => {
  loading.value = true
  const videoFiles = video.files
    .filter((file) => {
      return parseRes(file.label) <= parseRes(getPrefs<string>('media.maxRes'))
    })
    // Sort highest res first, then not subtitled first
    .sort((a, b) => {
      return (
        parseRes(b.label) - +b.subtitled - (parseRes(a.label) - +a.subtitled)
      )
    })

  try {
    const meetingFile: VideoFile = {
      duration: videoFiles[0].duration,
      filesize: videoFiles[0].filesize,
      markers: null,
      pub: '',
      title: video.title,
      track: 0,
      subtitled: videoFiles[0].subtitled,
      subtitles: videoFiles[0].subtitles,
      issue: '',
      safeName:
        sanitize(video.title) + extname(videoFiles[0].progressiveDownloadURL),
      url: videoFiles[0].progressiveDownloadURL,
      checksum: videoFiles[0].checksum,
      trackImage: getVideoImg(video.images),
      primaryCategory: video.primaryCategory,
    }
    emit('select', meetingFile)
  } catch (e: unknown) {
    log.error(e)
  }
  loading.value = false
}
const searchQuery = ref('')
const filteredVideos = computed(() => {
  const query = searchQuery.value.toLowerCase().trim()
  if (!query) {
    return latestVideos.value
  }
  return allVideos.value.filter((video) =>
    video.title.toLowerCase().includes(query),
  )
})
</script>
