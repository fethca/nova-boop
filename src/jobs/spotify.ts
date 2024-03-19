import { ILogger, Logger } from '@fethcat/logger'
import Fuse from 'fuse.js'
import { formatName, formatTitle, notEmpty } from '../helpers/utils.js'
import { spotifyService } from '../services/spotify.js'
import { Message, settings } from '../settings.js'
import { ITrack, Response } from '../types.js'

const { instanceId, logs, metadata } = settings

export class SpotifyJob {
  protected logger: ILogger<Message> = Logger.create<Message>(instanceId, logs, metadata)

  async run(songs: ITrack[]) {
    const { success, failure } = this.logger.action('spotify_handle_songs')
    try {
      const ids: string[] = []
      for (const song of songs) {
        const id = await this.getId(song)
        if (id) ids.push(id)
      }
      const playlist = await this.getPlaylist()
      await this.uploadSongs(ids, playlist)
      success()
    } catch (error) {
      failure(error)
    }
  }

  private async getId(song: ITrack): Promise<string | null> {
    if (song.spotifyId) return song.spotifyId
    const { artist, title } = song
    return await this.searchTrack(artist, title)
  }

  private async searchTrack(artist: string, title: string): Promise<string | null> {
    const { success, failure, skip } = this.logger.action('spotify_search_song')
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
        skip('spotify_no_match', { artist, title })
        return null
      }

      success()
      return track.id
    } catch (error) {
      throw failure(error)
    }
  }

  private matchTrack(artist: string, title: string, track: { artists: { name: string }[]; name: string }): boolean {
    const fuseOptions = { includeScore: true, threshold: 1.0 }

    const titleFuse = new Fuse([title], fuseOptions)
    const titleScore = Number(titleFuse.search(formatTitle(track.name))[0].score)

    const artists = artist.split('/').map((artist) => formatName(artist))
    const artistsFuse = new Fuse(artists, { ...fuseOptions, useExtendedSearch: true })
    const artistQuery = track.artists.map((person) => formatName(person.name)).join(' | ')
    const artistScore = Number(artistsFuse.search(artistQuery)[0].score)

    const metadata = { title, titleQuery: formatTitle(track.name), titleScore, artist, artistQuery, artistScore }
    this.logger.info('spotify_match_track_score', metadata)

    return titleScore < 0.4 && artistScore < 0.4
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
    const reorder: {
      positions?: ReadonlyArray<number> | undefined
      uri: string
    }[] = []
    try {
      for (const song of songs) {
        const index = playlist.indexOf(song)
        if (index > -1) reorder.push({ uri: this.prefix(song) })
        payload.push(this.prefix(song))
      }
      this.logger.addMeta({ reorder: reorder.length, upload: payload.length - reorder.length })
      await this.uploadBatch(reorder, spotifyService.removeTracksFromPlaylist.bind(spotifyService))
      await this.uploadBatch(payload, spotifyService.addTracksToPlaylist.bind(spotifyService), { position: 0 })
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
      for (let i = payload.length; i >= 0; ) {
        const end = i
        const start = i - 100 > 0 ? i - 100 : 0
        const batch = payload.slice(start, end)
        await uploadFn(settings.spotify.playlist, batch, opts)
        i = start - 1
      }
      success()
    } catch (error) {
      failure(error)
    }
  }
}
