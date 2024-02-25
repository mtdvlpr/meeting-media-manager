export type VFormRef = {
  errors: Ref<{ id: string | number; errorMessages: string[] }[]>
  isDisabled: ComputedRef<boolean>
  isReadonly: ComputedRef<boolean>
  isValidating: ShallowRef<boolean>
  isValid: Ref<boolean> & { externalValue: boolean }
  items: Ref<
    {
      id: string | number
      validate: () => Promise<string[]>
      reset: () => void
      resetValidation: () => void
      isValid: boolean
      errorMessages: string[]
    }[]
  >
  validate: () => Promise<{
    valid: boolean
    errors: { id: string | number; errorMessages: string[] }[]
  }>
  reset: () => void
  resetValidation: () => void
}

export type VOtpInputRef = {
  blur: () => void
  focus: () => void
  isFocused: Ref<boolean> & { externalValue: boolean }
  reset: () => void
}
