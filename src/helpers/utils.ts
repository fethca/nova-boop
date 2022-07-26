export function click(element: unknown) {
  if (element instanceof HTMLElement) {
    element.click()
  }
}

export function isHTMLElement(element: unknown) {
  if (element instanceof HTMLElement) {
    return element
  }
}
