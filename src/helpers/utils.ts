export function click(element: unknown) {
  if (element instanceof HTMLElement) {
    element.click()
  }
}
