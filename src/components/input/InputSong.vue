<template>
  <input-field
    id="song-picker"
    v-model="value"
    field="autocomplete"
    :items="songs"
    :label="$t('selectSong')"
    item-title="title"
    item-value="safeName"
    :loading="loading"
    return-object
  />
</template>
<script setup lang="ts">
import type { VideoFile } from '~~/types'

const value = defineModel<VideoFile | null>({ required: true })

const loading = ref(true)
const songs = ref<VideoFile[]>([])
const loadSongs = async () => {
  loading.value = true
  songs.value = await getSongs()
  loading.value = false
}

onMounted(() => {
  loadSongs()
})
</script>
