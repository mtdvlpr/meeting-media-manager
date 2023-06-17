import { createVuetify } from 'vuetify'
import '@mdi/font/css/materialdesignicons.css'
import SortableJs, { MultiDrag } from 'sortablejs'
import VueSortable from 'vue3-sortablejs'
import 'vuetify/styles'
SortableJs.mount(new MultiDrag()) // pre-build css styles

export default defineNuxtPlugin((nuxtApp) => {
  const vuetify = createVuetify({
    defaults: {
      VBtnToggle: {
        color: 'primary',
      },
      VField: {
        color: 'primary',
      },
      VProgressLinear: {
        color: 'primary',
      },
      VSelectionControl: {
        color: 'primary',
      },
      VSlider: {
        color: 'primary',
      },
      VTabs: {
        color: 'primary',
        grow: true,
      },
    },
    theme: {
      themes: {
        light: {
          dark: false,
          colors: {
            bg: '#fff',
            group: '#E0E0E0',
            subgroup: '#F5F5F5',
            regular: '#000',
            primary: '#0d6efd',
            song: '#055160',
            paragraph: '#41464b',
            secondary: '#6c757d',
            accent: '#f8f9fa',
            error: '#D50000',
            'error-light': '#FF5252',
            info: '#0dcaf0',
            success: '#4caf50',
            warning: '#ffc107',
            btn: '#424242',
            treasures: '#626262',
            apply: '#9d5d07',
            living: '#942926',
          },
        },
        dark: {
          dark: true,
          colors: {
            bg: '#121212',
            group: '#424242',
            subgroup: '#616161',
            regular: '#fff',
            primary: '#375a7f',
            song: '#5dbecd',
            paragraph: '#c1c1c1',
            secondary: '#626262',
            accent: '#9e9e9e',
            error: '#D50000',
            'error-light': '#FF5252',
            info: '#17a2b8',
            success: '#00e676',
            warning: '#f39c12',
            btn: '#3b3b3b',
            treasures: '#a7a7a7',
            apply: '#ecb368',
            living: '#d27674',
          },
        },
      },
    },
  })

  nuxtApp.vueApp.use(vuetify)
  nuxtApp.vueApp.use(VueSortable)
})
