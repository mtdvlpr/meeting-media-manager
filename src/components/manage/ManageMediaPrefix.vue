<template>
  <v-col cols="1" class="text-center" align-self="center">
    <v-icon icon="i-mdi:sort-numeric-variant" />
  </v-col>
  <v-col cols="11" class="d-flex" align-self="center">
    <v-text-field v-model="value" :disabled="loading" />
  </v-col>
</template>
<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  loading?: boolean
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', modelValue: string): void
}>()
const value = useVModel(props, 'modelValue', emit)
</script>
<!--<template>
  <v-row align="center" class="my-n4" style="width: 100%">
    <v-col cols="1" class="text-center" align-self="center">
      <v-icon icon="i-mdi:sort-numeric-variant" />
    </v-col>
    <v-col cols="11" class="d-flex">
      <v-col cols="4">
        <v-otp-input
          id="input-prefix-1"
          v-model="prefix1"
          type="number"
          length="2"
          dense
          :disabled="loading"
          @finish="focus($refs.prefix2)"
        />
      </v-col>
      <v-col cols="4">
        <v-otp-input
          v-if="prefix1"
          id="input-prefix-2"
          ref="prefix2"
          v-model="prefix2"
          type="number"
          length="2"
          dense
          :disabled="loading"
          @finish="focus($refs.prefix3)"
        />
      </v-col>
      <v-col cols="4">
        <v-otp-input
          v-if="prefix2"
          id="input-prefix-3"
          ref="prefix3"
          v-model="prefix3"
          type="number"
          length="2"
          dense
          :disabled="loading"
        />
      </v-col>
    </v-col>
  </v-row>
</template>
<script setup lang="ts">
const emit = defineEmits(['update:modelValue'])
const props = defineProps<{
  modelValue: string
  loading: boolean
}>()

const prefix1 = ref('')
const prefix2 = ref('')
const prefix3 = ref('')
const prefix = computed(() =>
  [prefix1.value, prefix2.value, prefix3.value].filter(Boolean).join('-')
)
watch(prefix, () => {
  emit('update:modelValue', prefix.value)
})
watch(
  () => props.modelValue,
  () => {
    setPrefix()
  }
)
const setPrefix = () => {
  const [p1, p2, p3] = props.modelValue.split('-')
  prefix1.value = p1 ?? ''
  prefix2.value = p2 ?? ''
  prefix3.value = p3 ?? ''
}
</script>
-->
