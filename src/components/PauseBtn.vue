<template>
  <v-tooltip :location="tooltip" :text="$t(video ? 'pause' : 'pauseImg')">
    <template #activator="{ props: attrs }">
      <v-btn
        v-bind="attrs"
        icon
        color="warning"
        aria-label="Pause"
        :class="{ 'pulse-danger': toggled, 'pause-btn': true }"
        @click="emit('click')"
      >
        <v-icon size="x-large">{{ video ? pauseIcon : pauseImageIcon }}</v-icon>
      </v-btn>
    </template>
  </v-tooltip>
</template>
<script setup lang="ts">
const props = defineProps<{
  toggled?: boolean
  tooltip?: 'top' | 'bottom' | 'start' | 'end'
  video?: boolean
}>()

const emit = defineEmits<{ (e: 'click'): void }>()

const pauseIcon = computed(() => (props.toggled ? 'i-mdi:play' : 'i-mdi:pause'))
const pauseImageIcon = computed(() => {
  return props.toggled ? 'i-mdi:video-box' : 'i-mdi:video-box-off'
})
</script>
