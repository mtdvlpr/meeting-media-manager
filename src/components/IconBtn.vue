<template>
  <v-btn
    ref="btn"
    v-click-outside="() => (clickedOnce = false)"
    icon
    :aria-label="variant"
    v-bind="{ ...style.props, ...$attrs }"
    :color="clickedOnce ? 'error' : style.props.color"
    :to="link"
    :class="{
      ...style.props.class,
    }"
    @click.stop="atClick()"
  >
    <v-tooltip
      v-if="clickedOnce"
      activator="parent"
      model-value
      :location="tooltip"
      @update:model-value="() => {}"
    >
      {{ $t('clickAgain') }}
    </v-tooltip>
    <v-icon
      v-bind="getIconProps(style.icon)"
      :icon="getIcon(style.icon)"
      :color="getIconColor(style.icon)"
    />
  </v-btn>
</template>
<script setup lang="ts">
type Variant = 'home' | 'cancel' | 'play' | 'stop'

defineOptions({ inheritAttrs: false })
const props = withDefaults(
  defineProps<{
    variant: Variant
    tooltip?: 'top' | 'bottom' | 'start' | 'end'
    iconColor?: string
    clickTwice?: boolean
    toggled?: boolean
    video?: boolean
  }>(),
  {
    tooltip: 'end',
    iconColor: undefined,
  },
)

// Emit click event
const emit = defineEmits<{ (e: 'click'): void }>()
const atClick = () => {
  if (props.clickTwice) {
    atFirstClick()
  } else {
    emit('click')
  }
}
const { atClick: atFirstClick, clickedOnce } = useClickTwice(() => {
  emit('click')
})

// Icon
const getIcon = (
  icon: string | { text: string; props?: Record<string, any> },
) => {
  return typeof icon === 'string' ? icon : icon.text
}

// Icon link
const localePath = useLocalePath()
const weekNr = useNumberQuery('week', useDayjs()().isoWeek())
const link = computed(() => {
  if (style.value.to) {
    return {
      path: localePath(style.value.to),
      query: {
        week: weekNr.value,
      },
    }
  }
  return useAttrs().to as string | undefined
})

// Icon color
const getIconColor = (
  icon?: string | { text: string; props?: Record<string, any> },
) => {
  if (clickedOnce.value) return 'white'
  if (props.iconColor) return props.iconColor
  if (typeof icon !== 'string' && icon?.props?.color) {
    return icon.props.color
  }
}

// Icon props
const getIconProps = (
  icon: string | { text: string; props?: Record<string, any> },
) => {
  return typeof icon === 'string' ? {} : icon.props
}

interface Style {
  to?: string
  props: Record<string, any>
  icon: string | { text: string; props?: Record<string, any> }
}

const styles: Record<string, Style> = {
  home: {
    to: '/home',
    props: {
      'min-width': '32px',
      color: 'btn',
    },
    icon: { text: 'i-mdi:home', props: { color: 'white' } },
  },
  cancel: {
    props: {
      'min-width': '32px',
      color: 'error',
    },
    icon: {
      text: 'i-mdi:arrow-left-bold-circle',
      props: { color: 'white', size: 'medium' },
    },
  },
  play: {
    props: { color: 'primary' },
    icon: { text: 'i-mdi:play', props: { size: 'x-large' } },
  },
  stop: {
    props: { color: 'warning' },
    icon: {
      text: 'i-mdi:stop',
      props: { size: 'x-large', color: 'black' },
    },
  },
}

const style = computed(() => styles[props.variant])
</script>
