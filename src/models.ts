export type OnNovaData<T> = (items: T[]) => Promise<void>

export type NovaResponse<T> = {
  _embedded?: { items?: T[] }
  _links?: { next?: { href: string } }
}
