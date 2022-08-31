export interface Track {
  positions?: ReadonlyArray<number> | undefined
  uri: string
}

interface Response<T> {
  body: T
  headers: Record<string, string>
  statusCode: number
}

interface PlaylistSnapshotResponse {
  snapshot_id: string
}

export type IPlaylistResponse =
  | Promise<Response<SpotifyApi.RemoveTracksFromPlaylistResponse>>
  | Promise<Response<SpotifyApi.AddTracksToPlaylistResponse>>
