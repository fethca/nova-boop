export interface Response<T> {
  body: T
  headers: Record<string, string>
  statusCode: number
}

export type ITrack = {
  artist: string
  title: string
  spotifyId?: string
  deezerId?: string
}
