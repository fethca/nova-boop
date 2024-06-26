import { ILogger, Logger } from '@fethcat/logger'
import Fuse from 'fuse.js'
import { formatName, formatTitle } from '../helpers/utils.js'
import { spotifyService } from '../services/services.js'
import { Message, settings } from '../settings.js'
import { ITrack, Response } from '../types.js'

const { instanceId, logs, metadata } = settings

export class SpotifyJob {
  protected logger: ILogger<Message> = Logger.create<Message>(instanceId, logs, metadata)

  async run(tracks: ITrack[]) {
    const { success, failure } = this.logger.action('spotify_handle_tracks')
    try {
      await spotifyService.refreshToken()
      const ids: string[] = []
      for (const track of tracks) {
        const id = await this.getId(track)
        if (id) ids.push(id)
      }
      const playlist = await spotifyService.fetchPlaylist()
      await this.uploadTracks(ids, playlist)
      success()
      return true
    } catch (error) {
      failure(error)
    }
  }

  private async getId(track: ITrack): Promise<string | null> {
    if (track.spotifyId) return track.spotifyId
    const { artist, title } = track
    const id = await this.searchTrack(artist, title)
    return id
  }

  private async searchTrack(artist: string, title: string): Promise<string | null> {
    const { success, failure, skip } = this.logger.action('spotify_search_tracks', { artist, title })
    try {
      const artists = artist.split('/')
      const formattedTitle = formatTitle(title)
      const options = { limit: 3 }
      let track: SpotifyApi.TrackObjectFull | undefined
      for (const person of artists) {
        const queries = [
          `track:${formattedTitle} artist:${formatName(person)}`,
          `${formattedTitle} ${formatName(person)}`,
        ]
        for (const query of queries) {
          const results = await spotifyService.searchTracks(query, options)
          track = results.body.tracks?.items.find((track) => this.matchTrack(artist, formattedTitle, track))
          if (track) break
        }
        if (track) break
      }

      if (!track) {
        skip('spotify_no_match')
        return null
      }

      success()
      return track.id
    } catch (error) {
      failure(error)
      return null
    }
  }

  private matchTrack(artist: string, title: string, track: { artists: { name: string }[]; name: string }): boolean {
    const fuseOptions = { includeScore: true, threshold: 1.0 }

    const titleFuse = new Fuse([title], fuseOptions)
    const titleScore = Number(titleFuse.search(formatTitle(track.name))[0]?.score)

    const artists = artist.split('/').map((artist) => formatName(artist))
    const artistsFuse = new Fuse(artists, { ...fuseOptions, useExtendedSearch: true })
    const artistQuery = track.artists.map((person) => formatName(person.name)).join(' | ')
    const artistScore = Number(artistsFuse.search(artistQuery)[0]?.score)

    const metadata = { title, titleQuery: formatTitle(track.name), titleScore, artist, artistQuery, artistScore }
    this.logger.info('spotify_match_track_score', metadata)

    return titleScore < 0.4 && artistScore < 0.4
  }

  private async uploadTracks(tracks: string[], playlist: string[]) {
    const { success, failure } = this.logger.action('spotify_upload_tracks')
    const payload: string[] = []
    const reorder: { positions?: ReadonlyArray<number> | undefined; uri: string }[] = []
    try {
      for (const track of tracks) {
        const index = playlist.indexOf(track)
        if (index > -1) {
          playlist.splice(index, 1)
          reorder.push({ uri: this.prefix(track) })
        }
        payload.push(this.prefix(track))
      }
      this.logger.addMeta({ reorder: reorder.length, upload: payload.length - reorder.length })
      if (reorder.length) await this.uploadBatch(reorder, spotifyService.removeTracksFromPlaylist.bind(spotifyService))
      await this.uploadBatch(payload, spotifyService.addTracksToPlaylist.bind(spotifyService), { position: 0 })
      spotifyService.cachePlaylist([...tracks, ...playlist])
      success()
    } catch (error) {
      failure(error)
    }
  }

  private prefix(id: string) {
    return `spotify:track:${id}`
  }

  private async uploadBatch<P, O, R extends SpotifyApi.PlaylistSnapshotResponse>(
    payload: P[],
    uploadFn: (id: string, payload: P[], opt?: O) => Promise<Response<R>>,
    opts?: O,
  ) {
    const { success, failure } = this.logger.action('spotify_upload_batch')
    try {
      for (let i = payload.length; i > 0; ) {
        const end = i
        const start = i - 100 > 0 ? i - 100 : 0
        const batch = payload.slice(start, end)
        await uploadFn(settings.spotify.playlist, batch, opts)
        i = start
      }
      success()
    } catch (error) {
      failure(error)
    }
  }
}
