<template>
  <v-menu
    v-model="menu"
    :close-on-content-click="false"
    transition="scale-transition"
    min-width="auto"
  >
    <template #activator="{ props: menuProps }">
      <input-field
        :id="id"
        v-model="formatted"
        :label="label"
        prepend-inner-icon="i-mdi:calendar"
        readonly
        v-bind="{ ...menuProps, ...$attrs }"
      />
    </template>
    <v-date-picker
      v-model="date"
      :min="min"
      :max="max"
      :allowed-dates="allowedDates"
      hide-header
    />
  </v-menu>
</template>
<script setup lang="ts">
defineOptions({ inheritAttrs: false })
const props = withDefaults(
  defineProps<{
    id: string
    modelValue: string | null
    label: string
    min?: string
    max?: string
    format?: string
    allowedDates?: (date: any) => boolean
  }>(),
  {
    min: undefined,
    max: undefined,
    format: 'YYYY-MM-DD',
    allowedDates: undefined,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', val: typeof props.modelValue): void
}>()

const menu = ref(false)
const date = ref<Date | null>(null)
const formatted = ref<string | null>(null)
const dayjs = useDayjs()

watchImmediate(
  () => props.modelValue,
  (val) => {
    formatted.value = val as string | null
    date.value = val ? dayjs(val as string, props.format).toDate() : null
  },
)

watch(date, (val) => {
  formatted.value = val ? dayjs(val).format(props.format) : null
  menu.value = false
  emit('update:modelValue', formatted.value)
})

watch(formatted, (val) => {
  date.value = val ? dayjs(val, props.format).toDate() : null
})
</script>
