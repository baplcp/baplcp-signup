import { nextTick, reactive, ref } from 'vue'

export function usePageFeedback() {
  const dialog = reactive({
    open: false,
    title: '報名已送出',
    copy: '已送出報名 0 位，請稍候確認名單是否成功加入',
    buttonText: '確認',
    onButtonClick: null,
  })
  const buttonRef = ref(null)
  let returnFocus = null

  function focusElement(target) {
    nextTick(() => target?.value?.focus?.({ preventScroll: true }))
  }

  function show(options, focusAfterClose = null) {
    dialog.title = options.title ?? dialog.title
    dialog.copy = options.copy ?? dialog.copy
    dialog.buttonText = options.buttonText ?? '確認'
    dialog.onButtonClick = options.onButtonClick ?? null
    returnFocus = focusAfterClose
    dialog.open = true
    focusElement(buttonRef)
  }

  function close() {
    dialog.open = false
    const target = returnFocus
    returnFocus = null
    target?.()
  }

  function handleButtonClick() {
    const callback = dialog.onButtonClick
    close()
    callback?.()
  }

  return { dialog, buttonRef, focusElement, show, close, handleButtonClick }
}
