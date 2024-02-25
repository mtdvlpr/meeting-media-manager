<template>
  <tree-view :config="config" :nodes="tree" class="cong-treeview">
    <template #after-input="{ node }">
      <div v-if="node.dir" class="d-flex justify-end" style="width: 100%">
        <v-btn
          variant="text"
          icon="i-mdi:folder-arrow-right"
          size="x-small"
          @click="emit('open', node.id)"
        />
      </div>
    </template>
  </tree-view>
</template>
<script setup lang="ts">
import 'vue3-treeview/dist/style.css'
// @ts-expect-error: cannot find declaration file
import TreeView from 'vue3-treeview'
import type { CongFile } from '~~/types'

type TreeObj = Record<
  string,
  {
    text: string
    dir: boolean
    state: Record<string, boolean>
    children: string[]
  }
>

const props = defineProps<{
  contents: CongFile[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  open: [filename: string]
}>()

const tree = ref({})

onMounted(() => {
  setTree()
})

watch(
  () => props.contents,
  () => {
    setTree()
  },
)

const config = computed(() => {
  return {
    roots: props.contents.map((f) => f.filename),
    disabled: props.disabled,
  }
})

const setTree = () => {
  const treeObj: TreeObj = {}
  props.contents.forEach((file) => {
    addToTree(treeObj, file)
  })
  tree.value = treeObj
}

const addToTree = (treeObj: TreeObj, file: CongFile) => {
  treeObj[file.filename] = {
    text: file.basename,
    state: {},
    dir: file.type === 'directory',
    children: file.children?.map((f) => f.filename) ?? [],
  }
  if (file.children) {
    file.children.forEach((f) => {
      addToTree(treeObj, f)
    })
  }
}
</script>
<style lang="scss" scoped>
.cong-treeview :deep(.node-wrapper) {
  .input-wrapper {
    color: inherit !important;
  }
  .icon-wrapper {
    path {
      fill: rgb(var(--v-theme-regular)) !important;
    }
  }

  &:focus {
    background-color: unset !important;
  }
  &:hover {
    background-color: rgb(var(--v-theme-bg)) !important;
  }
}
</style>
<!--
<template>
  <v-treeview
    v-model="tree"
    :items="contents"
    item-key="filename"
    item-title="basename"
    open-on-click
  >
    <template #prepend="{ item, open }">
      <v-icon v-if="item.type === 'file'" icon="i-mdi:file" />
      <v-icon v-else :icon="open ? faFolderOpen : faFolder" />
    </template>
    <template #append="{ item }">
      <v-btn
        v-if="item.type === 'directory'"
        icon
        @click="emit('open', item.filename)"
      >
        <v-icon icon="i-mdi:folder-arrow-right" />
      </v-btn>
    </template>
  </v-treeview>
</template>
-->
