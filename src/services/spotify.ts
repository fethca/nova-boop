import { ILogger, Logger } from '@fethcat/logger'
import SpotifyWebApi from 'spotify-web-api-node'
import { notEmpty, wait } from '../helpers/utils.js'
import { Message, settings } from '../settings.js'

const { instanceId, logs, metadata } = settings

export class SpotifyService extends SpotifyWebApi {
  protected logger: ILogger<Message> = Logger.create<Message>(instanceId, logs, metadata)
  private inMemoryPlaylist: string[] | undefined

  async refreshToken() {
    const { success, failure } = this.logger.action('spotify_refresh_token')
    try {
      this.setRefreshToken(settings.spotify.refresh_token)
      const data = await this.refreshAccessToken()
      this.setAccessToken(data.body['access_token'])
      success()
    } catch (error) {
      throw failure(error)
    }
  }

  async fetchPlaylist(): Promise<string[]> {
    const { success, failure } = this.logger.action('spotify_get_playlist')
    if (this.inMemoryPlaylist) return this.inMemoryPlaylist
    try {
      const { playlist, expected } = await this.getTracksBatch()
      this.cachePlaylist(playlist)
      success({ nbTracks: playlist.length, expected })
      return playlist
    } catch (error) {
      throw failure(error)
    }
  }

  cachePlaylist(playlist: string[]) {
    this.inMemoryPlaylist = playlist
  }

  private async getTracksBatch(): Promise<{ playlist: string[]; expected: number }> {
    let next: boolean = true
    let offset: number = 0
    let expected: number = 0
    const playlist: string[] = []
    const fields = 'total, next, limit, offset, items(track(id))'
    while (next) {
      let retry = 0
      let done = false
      while (!done && retry <= 10) {
        const { success, failure } = this.logger.action('spotify_get_playlist_tracks', { offset, expected })
        try {
          const data = await this.getPlaylistTracks(settings.spotify.playlist, { limit: 100, offset, fields })
          const { items } = data.body
          expected = data.body.total
          if (items) playlist.push(...data.body.items.map((item) => item?.track?.id).filter(notEmpty))
          if (data.body.next) {
            next = true
            offset = data.body.offset + data.body.limit
          } else {
            next = false
          }
          done = true
          success()
        } catch (error) {
          if (this.isSpotifyDownError(error)) {
            failure(error)
            await wait(5000)
            retry++
          } else {
            throw failure(error)
          }
        }
      }
    }
    return { playlist, expected }
  }

  private isSpotifyDownError(error: unknown) {
    if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
      return error.message.includes('WebapiRegularError') && error.message.includes('Request timed out')
    }
  }
}
