import { notEmpty } from '@src/helpers/utils'
import { ILogger } from '@src/logger'
import { IPlaylistResponse, Track } from '@src/models'
import { spotifyService } from '@src/services/spotify'
import { Message, settings } from '@src/settings'

export class SpotifyJob {
  constructor(private logger: ILogger<Message>) {}
  async run(songs: string[]) {
    const { success, failure } = this.logger.action('spotify_handle_songs')
    try {
      const playlist = await this.getPlaylist()
      await this.uploadSongs(songs, playlist)
      success()
    } catch (error) {
      failure(error)
    }
  }

  private async getPlaylist(): Promise<string[]> {
    const { success, failure } = this.logger.action('spotify_get_playlist')
    try {
      const { playlist, expected } = await this.getTracksBatch()
      success({ nbTracks: playlist.length, expected })
      return playlist
    } catch (error) {
      throw failure(error)
    }
  }

  private async getTracksBatch<T>(): Promise<{ playlist: string[]; expected: number }> {
    let next: boolean = true
    let offset: number = 0
    let playlist: string[] = []
    let expected: number = 0
    const fields = 'total, next, limit, offset, items(track(id))'
    while (next) {
      const data = await spotifyService.getPlaylistTracks(settings.spotify.playlist, {
        limit: 100,
        offset,
        fields,
      })
      if (data.body.total) expected = data.body.total
      if (data.body.items) playlist.push(...data.body.items.map((item) => item?.track?.id).filter(notEmpty))
      if (data.body.next) {
        next = true
        offset = data.body.offset + data.body.limit
      } else next = false
    }
    return { playlist, expected }
  }

  private async uploadSongs(songs: string[], playlist: string[]) {
    const { success, failure } = this.logger.action('spotify_upload_songs')
    const payload: string[] = []
    const reorder: Track[] = []
    try {
      for (const song of songs) {
        const index = playlist.indexOf(song)
        if (index > -1) reorder.push({ uri: this.prefix(song) })
        payload.push(this.prefix(song))
      }
      if (reorder.length) {
        while (reorder.length) {
          const batch = reorder.slice(0, 99)
          await spotifyService.removeTracksFromPlaylist(settings.spotify.playlist, batch)
          reorder.splice(0, 99)
        }
      }
      while (payload.length) {
        const batch = payload.slice(0, 99)
        await spotifyService.addTracksToPlaylist(settings.spotify.playlist, batch.reverse(), { position: 0 })
        payload.splice(0, 99)
      }
      success()
    } catch (error) {
      failure(error)
    }
  }

  private async uploadBatch(
    payload: string[] | Track[],
    uploadFn: (id: string, payload: string[] | Track[], opt?: { position: number }) => Promise<IPlaylistResponse>,
    opts?: { position: number }
  ) {
    const { success, failure } = this.logger.action('spotify_upload_batch')
    try {
      while (payload.length) {
        const batch = payload.slice(0, 99)
        const result = await uploadFn(settings.spotify.playlist, batch, opts)
        payload.splice(0, 99)
      }
    } catch (error) {
      failure(error)
    }
  }

  private prefix(id: string) {
    return `spotify:track:${id}`
  }
}
