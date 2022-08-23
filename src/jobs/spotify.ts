import { ILogger } from '@src/logger'
import { INovaSong, ISong } from '@src/models'
import { spotifyService } from '@src/services/spotify'
import { Message, settings } from '@src/settings'

export class SpotifyJob {
  constructor(private logger: ILogger<Message>) {}
  async run(songs: INovaSong[]) {
    const { success, failure } = this.logger.action('spotify_handle_songs')
    try {
      const playlist = await this.getPlaylist()
      await this.uploadSongs(songs, playlist)
      success()
    } catch (error) {
      failure(error)
    }
  }

  private async getPlaylist(): Promise<ISong[]> {
    const { success, failure } = this.logger.action('spotify_get_playlist')
    try {
      const { playlist, expected } = await this.getTracksBatch()
      success({ nbTracks: playlist.length, expected })
      return playlist
    } catch (error) {
      throw failure(error)
    }
  }

  private async getTracksBatch<T>(): Promise<{ playlist: ISong[]; expected: number }> {
    let next: boolean = true
    let offset: number = 0
    let playlist: ISong[] = []
    let expected: number = 0
    const fields = 'total, next, limit, offset, items(track(id))'
    while (next) {
      const data = await spotifyService.getPlaylistTracks(settings.spotify.playlist, {
        limit: 100,
        offset,
        fields,
      })
      if (data.body.total) expected = data.body.total
      if (data.body.items) playlist.push(...data.body.items.map((item) => ({ spotifyId: item?.track?.id || '' })))
      if (data.body.next) {
        next = true
        offset = data.body.offset + data.body.limit
      } else next = false
    }
    return { playlist, expected }
  }

  private async uploadSongs(songs: INovaSong[], playlist: ISong[]) {
    const { success, failure } = this.logger.action('spotify_upload_songs')
    for (const song of songs) {
    }
  }
}
