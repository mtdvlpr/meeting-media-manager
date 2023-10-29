<!-- eslint-disable vuetify/no-deprecated-components -->
<template>
  <v-col class="d-flex pa-0">
    <v-col v-show="!disableHours" cols="2" class="pa-0">
      <v-otp-input
        id="input-hours"
        ref="hourRef"
        v-model="hours"
        type="number"
        length="2"
        :rules="[(v: string) => validHours]"
        :disabled="disableHours"
        @update:model-value="handleChange"
      />
    </v-col>
    <v-col
      v-if="!disableHours"
      cols="auto"
      class="py-0 px-1 d-flex align-center justify-center"
    >
      <span>:</span>
    </v-col>
    <v-col cols="2" class="pa-0">
      <v-otp-input
        id="input-minutes"
        ref="minRef"
        v-model="minutes"
        type="number"
        length="2"
        :rules="[(v: string) => validMinutes]"
        @update:model-value="handleChange"
      />
    </v-col>
    <v-col cols="auto" class="py-0 px-1 d-flex align-center justify-center">
      <span>:</span>
    </v-col>
    <v-col cols="2" class="pa-0">
      <v-otp-input
        id="input-seconds"
        ref="secRef"
        v-model="seconds"
        type="number"
        length="2"
        :rules="[(v: string) => validSeconds]"
        @update:model-value="handleChange"
      />
    </v-col>
    <v-col cols="auto" class="py-0 px-1 d-flex align-center justify-center">
      <span>.</span>
    </v-col>
    <v-col cols="3" class="pa-0">
      <v-otp-input
        id="input-ms"
        ref="msRef"
        v-model="ms"
        type="number"
        length="3"
        :rules="[(v: string) => validMs]"
        @update:model-value="handleChange"
      />
    </v-col>
    <v-col class="pa-0 px-6 d-flex align-center justify-end">
      <slot />
    </v-col>
  </v-col>
</template>
<script setup lang="ts">
import type { VOtpInputRef } from '~~/types'

const props = defineProps<{
  modelValue: string
  min: string
  max: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', modelValue: string): void
  (e: 'valid', valid: boolean): void
}>()

watch(
  () => props.modelValue,
  (val) => {
    setValue(val || '')
  },
)

onMounted(() => {
  setValue(props.modelValue || '')
  handleChange()
  emit('valid', valid.value)
})

const hourRef = ref<VOtpInputRef | null>(null)
const minRef = ref<VOtpInputRef | null>(null)
const secRef = ref<VOtpInputRef | null>(null)
const msRef = ref<VOtpInputRef | null>(null)

const hours = ref('')
const minutes = ref('')
const seconds = ref('')
const ms = ref('')

const isTimestamp = (val: string) =>
  !!val && /\d{2}:\d{2}:\d{2}.\d{3}/.test(val)
const getHours = (val: string) => Number(val.split(':')[0] || '0')
const getMinutes = (val: string) => Number(val.split(':')[1] || '0')
const getMs = (val: string) => Number(val.split(':')[2]?.split('.')[1] || '0')
const getSeconds = (val: string) => {
  return Number(val.split(':')[2]?.split('.')[0] || '0')
}

const disableHours = computed(() => {
  return (hours.value == '0' || hours.value === '00') && maxHours.value === 0
})

// Min
const minHours = computed(() => {
  return isTimestamp(props.min) ? getHours(props.min) : 0
})
const minMinutes = computed(() => {
  return isTimestamp(props.min) ? getMinutes(props.min) : 0
})
const minSeconds = computed(() => {
  return isTimestamp(props.min) ? getSeconds(props.min) : 0
})
const minMs = computed(() => (isTimestamp(props.min) ? getMs(props.min) : 0))

// Max
const maxHours = computed(() => {
  const MAX = 99
  return isTimestamp(props.max) ? getHours(props.max) : MAX
})

const maxMinutes = computed(() => {
  const MAX = 99
  if (+hours.value < maxHours.value) return MAX
  return isTimestamp(props.max) ? getMinutes(props.max) : MAX
})

const maxSeconds = computed(() => {
  const MAX = 99
  if (+minutes.value < maxMinutes.value) return MAX
  return isTimestamp(props.max) ? getSeconds(props.max) : MAX
})

const maxMs = computed(() => {
  const MAX = 999
  if (+seconds.value < maxSeconds.value) return MAX
  return isTimestamp(props.max) ? getMs(props.max) : MAX
})

// Valid
const validHours = computed(() => {
  if (!hours.value) return false
  console.log('hours', hours.value)
  return +hours.value >= minHours.value && +hours.value <= maxHours.value
})

const validMinutes = computed(() => {
  if (!minutes.value) return false
  return (
    +minutes.value >= minMinutes.value && +minutes.value <= maxMinutes.value
  )
})

const validSeconds = computed(() => {
  if (!seconds.value) return false
  return (
    +seconds.value >= minSeconds.value && +seconds.value <= maxSeconds.value
  )
})
const validMs = computed(() => {
  if (!ms.value) return false
  return +ms.value >= minMs.value && +ms.value <= maxMs.value
})

const valid = computed(() => {
  return (
    validHours.value &&
    validMinutes.value &&
    validSeconds.value &&
    validMs.value
  )
})
watch(valid, (val) => {
  emit('valid', val)
})

const setValue = (val: string) => {
  console.log('h', hours.value)
  console.log('m', minutes.value)
  console.log('s', seconds.value)
  console.log('ms', ms.value)
  if (isTimestamp(val)) {
    const [h, m, s] = val.split(':')
    hours.value = h
    minutes.value = m
    seconds.value = s.split('.')[0]
    ms.value = s.split('.')[1]
  } else {
    resetValue()
    handleChange()
  }
  console.log('h', hours.value)
  console.log('m', minutes.value)
  console.log('s', seconds.value)
  console.log('ms', ms.value)
}

const resetValue = () => {
  hours.value = ''
  minutes.value = ''
  seconds.value = ''
  ms.value = ''
}

const handleChange = () => {
  const val = `${hours.value.toString().padStart(2, '0')}:${minutes.value
    .toString()
    .padStart(2, '0')}:${seconds.value.toString().padStart(2, '0')}.${ms.value
    .toString()
    .padStart(3, '0')}`
  emit('update:modelValue', val)
}

const focus = (ref: 'hour' | 'min' | 'sec' | 'ms') => {
  switch (ref) {
    case 'hour':
      hourRef.value?.focus()
      break
    case 'min':
      minRef.value?.focus()
      break
    case 'sec':
      secRef.value?.focus()
      break
    case 'ms':
      msRef.value?.focus()
      break
  }
}
</script>
