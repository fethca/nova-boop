export interface Track {
  positions?: ReadonlyArray<number> | undefined
  uri: string
}

export interface Response<T> {
  body: T
  headers: Record<string, string>
  statusCode: number
}
