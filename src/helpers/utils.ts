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

export function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
  return value !== null && value !== undefined
}

// const isFruit = (x: any): x is Fruit => fruit.includes(x)

// export const isTrackArray = (value: unknown): value is Track => {}
