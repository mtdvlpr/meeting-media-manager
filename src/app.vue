<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
<script setup lang="ts">
const i18n = useI18n()
const lang = computed(() => {
  return i18n.localeProperties.value.iso ?? i18n.locale.value
})

useHead({
  htmlAttrs: { lang },
  title: APP_LONG_NAME,
  titleTemplate: (titleChunk) => {
    return titleChunk ? `${titleChunk} - ${APP_SHORT_NAME}` : APP_LONG_NAME
  },
})
</script>
