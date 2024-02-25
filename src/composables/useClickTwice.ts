import { MS_IN_SEC } from './../constants/general'

export default function <T = any>(atClickedTwice: (object?: T) => void) {
  const clickedOnce = ref(false)

  const atClick = (object?: T) => {
    if (clickedOnce.value) {
      atClickedTwice(object)
      clickedOnce.value = false
    } else {
      clickedOnce.value = true
      setTimeout(() => {
        clickedOnce.value = false
      }, 3 * MS_IN_SEC)
    }
  }

  return { atClick, clickedOnce }
}
