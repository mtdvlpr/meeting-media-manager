<template>
  <v-col cols="auto">
    <v-btn
      :id="`btn-browse-${type}`"
      color="primary"
      style="height: 40px"
      :disabled="loading"
      @click="emit('click')"
    >
      {{ $t('browse') }}
    </v-btn>
  </v-col>
  <v-col cols="10">
    <v-slide-group v-if="files.length > 0" show-arrows>
      <v-slide-group-item v-for="(file, i) in files" :key="file.safeName">
        <v-chip
          size="small"
          class="ml-2 my-1"
          :closable="!loading"
          @click:close="emit('remove', i)"
        >
          {{ file.safeName }}
        </v-chip>
      </v-slide-group-item>
      <template #prev>
        <v-btn icon="i-mdi:chevron-left" variant="text" size="x-small" />
      </template>
      <template #next>
        <v-btn icon="i-mdi:chevron-right" variant="text" size="x-small" />
      </template>
    </v-slide-group>
  </v-col>
</template>
<script setup lang="ts">
import type { LocalFile, VideoFile } from '~~/types'
defineProps<{
  type: string
  files: (LocalFile | VideoFile)[]
  loading?: boolean
}>()
const emit = defineEmits<{
  click: []
  reset: []
  remove: [index: number]
}>()
</script>
