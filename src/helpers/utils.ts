export function click(element: unknown) {
  if (element instanceof HTMLElement) {
    element.click()
  }
}

export function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
