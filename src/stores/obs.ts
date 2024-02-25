interface OBSStore {
  connected: boolean
  scenes: string[]
  currentScene: string
}

export const useObsStore = defineStore('obs', {
  state: (): OBSStore => ({
    connected: false, // Whether OBS is connected
    scenes: [], // The available OBS scenes
    currentScene: '', // The current scene in OBS
  }),
})
