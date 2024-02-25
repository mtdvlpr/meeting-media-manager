<template>
  <v-dialog v-model="active" :max-width="500" persistent>
    <v-card :title="$t('areYouSure')">
      <v-card-text>
        {{ $t(description) }}
        <slot />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn color="error" @click="emit('cancel')">
          {{ $t('cancel') }}
        </v-btn>
        <v-btn color="success" @click="emit('confirm')">
          {{ $t('confirm') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
<script setup lang="ts">
defineProps<{
  description: string
}>()

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const active = defineModel<boolean>({ required: true })
</script>
