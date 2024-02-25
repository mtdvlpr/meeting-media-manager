<template>
  <input-field
    id="publication-picker"
    v-model="value"
    field="autocomplete"
    :items="publications"
    :label="$t('selectPublication')"
    :loading="loading"
    return-object
  />
</template>
<script setup lang="ts">
const value = defineModel<{ title: string; pub: string } | null>({
  required: true,
})

const loading = ref(true)
const publications = ref<{ title: string; pub: string }[]>([])
const loadPublications = async () => {
  loading.value = true
  publications.value = await getPublications()
  loading.value = false
}

onMounted(() => {
  loadPublications()
})

async function getPublications() {
  const langSymbol = (await getJWLangs()).find(
    (lang) => lang.langcode === getPrefs<string>('media.lang'),
  )?.symbol
  const result = langSymbol
    ? (await fetchPublicationList(langSymbol)).choices
        .filter((choice: { optionValue: string }) => choice.optionValue)
        .map(
          ({
            optionName: title,
            optionValue: pub,
          }: {
            optionName: string
            optionValue: string
          }) => ({ title, pub }),
        )
    : []
  return result
}
</script>
