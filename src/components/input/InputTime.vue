<!-- eslint-disable vue/prefer-true-attribute-shorthand -->
<template>
  <div :id="id">
    <vue-date-picker
      v-model="value"
      model-type="format"
      :dark="isDark"
      :disabled="isLocked(id)"
      :required="required"
      :state="required && !value ? false : undefined"
      :clearable="!required"
      :select-text="$t('confirm')"
      :cancel-text="$t('cancel')"
      time-picker
      :teleport="true"
      :teleport-center="true"
      minutes-increment="5"
    />
  </div>
</template>
<script setup lang="ts">
import '@vuepic/vue-datepicker/dist/main.css'
import VueDatePicker from '@vuepic/vue-datepicker'

defineProps<{
  id: string
  required?: boolean
}>()

const { isDark } = useTheme()
const value = defineModel<any>({ default: null })
</script>
<!--
<template>
  <v-dialog
    ref="dialog"
    v-model="dialog"
    :return-value.sync="$attrs.value"
    width="290px"
  >
    <template #activator="{ on, attrs }">
      <input-field
        :id="id ? id + '-field' : 'timepicker-field'"
        ref="field"
        v-model="$attrs.value"
        :label="label"
        readonly
        :locked="locked"
        :dense="false"
        v-bind="{ ...attrs, ...$attrs }"
        hide-details
        style="min-width: 85px; max-width: 85px"
        v-on="on"
      >
        <template v-if="!locked" #append>
          <v-icon icon="i-mdi:clock" style="margin-top: 2px" />
        </template>
      </input-field>
    </template>
    <v-time-picker
      v-if="dialog"
      :id="id ? id + '-picker' : 'timepicker'"
      ref="field"
      v-model="$attrs.value"
      full-width
      :use-seconds="useSeconds"
      format="24hr"
      @click:minute="$refs.dialog.save($attrs.value)"
      @change="emit('input', $event)"
    />
  </v-dialog>
</template>
-->
