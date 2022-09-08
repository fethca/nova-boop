import { notEmpty } from '@src/helpers/utils'
import { ILogger } from '@src/logger'
import { Response, Track } from '@src/models'
import { redisStore } from '@src/services/redis'
import { spotifyService } from '@src/services/spotify'
import { Message, settings } from '@src/settings'
import { setLastUpdateDate } from '@src/store'
import moment from 'moment'

export class SpotifyJob {
  constructor(private logger: ILogger<Message>) {}
  async run(songs: string[]) {
    const { success, failure } = this.logger.action('spotify_handle_songs')
    try {
      await this.connectSpotify()
      const playlist = await this.getPlaylist()
      await this.uploadSongs(songs, playlist)
      const updateDate = moment(`${moment().format('YYYY-MM-DD')}T${redisStore.tempDate}:00+02:00`).valueOf()
      await setLastUpdateDate(updateDate)
      success()
    } catch (error) {
      failure(error)
    }
  }

  private async connectSpotify() {
    const { success, failure } = this.logger.action('spotify_connect')
    try {
      spotifyService.setRefreshToken(settings.spotify.refresh_token)
      await spotifyService
        .refreshAccessToken()
        .then((data) => {
          spotifyService.setAccessToken(data.body['access_token'])
        })
        .catch((error) => {
          throw error
        })
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
    let payload: string[] = []
    const reorder: Track[] = []
    try {
      for (const song of songs) {
        const index = playlist.indexOf(song)
        if (index > -1) reorder.push({ uri: this.prefix(song) })
        payload.push(this.prefix(song))
      }
      this.logger.addMeta({ reorder: reorder.length, upload: payload.length - reorder.length })

      for (let i = 0; i < reorder.length; i += 100) {
        const batch = reorder.slice(i, i + 100)
        await spotifyService.removeTracksFromPlaylist(settings.spotify.playlist, batch)
      }
      for (let i = 0; i < payload.length; i += 100) {
        const batch = payload.slice(i, i + 100)
        await spotifyService.addTracksToPlaylist(settings.spotify.playlist, batch.reverse(), { position: 0 })
      }

      //WIP token errors
      // await this.uploadBatch(reorder, spotifyService.removeTracksFromPlaylist)
      // await this.uploadBatch(payload, spotifyService.addTracksToPlaylist, { position: 0 })
      success()
    } catch (error) {
      failure(error)
    }
  }

  private async uploadBatch<P, O, R extends SpotifyApi.PlaylistSnapshotResponse>(
    payload: P[],
    uploadFn: (id: string, payload: P[], opt?: O) => Promise<Response<R>>,
    opts?: O
  ) {
    const { success, failure } = this.logger.action('spotify_upload_batch')
    try {
      for (let i = 0; i < payload.length; i += 100) {
        const batch = payload.slice(i, i + 100)
        await uploadFn(settings.spotify.playlist, batch, opts)
      }
      success()
    } catch (error) {
      failure(error)
    }
  }

  private prefix(id: string) {
    return `spotify:track:${id}`
  }
}
