import { ILogger } from '@src/logger'
import { INovaSong } from '@src/models'
import { spotifyService } from '@src/services/spotify'
import { Message, settings } from '@src/settings'

export class SpotifyJob {
  constructor(private logger: ILogger<Message>) {}
  run(songs: INovaSong[]) {
    const { success, failure } = this.logger.action('spotify_handle_songs')
    try {
      const playlist = this.getPlaylist()

      success()
    } catch (error) {
      failure(error)
    }
  }

  private async getPlaylist() {
    const { success, failure } = this.logger.action('spotify_get_playlist')
    try {
      const playlist = await spotifyService.getPlaylist(settings.spotify.playlist)
      success({ nbTracks: playlist.body.tracks.total })
      return playlist
    } catch (error) {
      failure(error)
    }
  }

  private async uploadSongs(songs: INovaSong[]) {
    const { success, failure } = this.logger.action('spotify_get_playlist')
  }
}
