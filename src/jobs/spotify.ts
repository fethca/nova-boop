import { notEmpty } from '@src/helpers/utils'
import { ILogger } from '@src/logger'
import { Track } from '@src/models'
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
        const index = playlist.indexOf(this.prefix(song))
        if (index > -1) reorder.push({ uri: this.prefix(song) })
        payload.push(this.prefix(song))
      }
      if (reorder.length) await spotifyService.removeTracksFromPlaylist(settings.spotify.playlist, reorder)
      await spotifyService.addTracksToPlaylist(settings.spotify.playlist, payload.reverse(), { position: 0 })
      success()
    } catch (error) {
      failure(error)
    }
  }

  private async uploadBatch() {
    //Limit payload de 100 dans les deux cas
    // await spotifyService.removeTracksFromPlaylist(settings.spotify.playlist, reorder) || await spotifyService.addTracksToPlaylist(settings.spotify.playlist, payload.reverse(), { position: 0 })
  }

  private prefix(id: string) {
    return `spotify:track:${id}`
  }
}
