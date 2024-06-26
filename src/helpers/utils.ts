import latinize from 'latinize'
import { DateTime } from 'luxon'

export function click(element: unknown) {
  if (element instanceof HTMLElement) {
    element.click()
  }
}

export function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
  return value !== null && value !== undefined
}

export function findText(text: string) {
  return `::-p-xpath(//*[contains(text(), '${text}')])`
}

export function formatTitle(title: string): string {
  return latinize(
    title
      .toLowerCase()
      .replace(/\s*\([^)]*\)$/, '')
      .replace(/'/g, ' ')
      .replace(/\s+/g, ' ')
      .trimEnd(),
  )
}

export function formatName(name: string): string {
  return latinize(name.replace(/'/g, ' ').replace(/\s+/g, ' ').trimEnd()).toLowerCase()
}

export function franceTZ(date: DateTime): DateTime {
  return date.setZone('Europe/Paris')
}
