import { MockedLogger, mockAction } from '@fethcat/logger'
import * as utils from '../../../src/helpers/utils.js'
import { SpotifyService } from '../../../src/services/spotify.js'

describe('refreshToken', () => {
  function createService() {
    const service = new SpotifyService()
    service['logger'] = new MockedLogger()
    service['setRefreshToken'] = vi.fn()
    service['refreshAccessToken'] = vi.fn().mockResolvedValue({ body: { access_token: 'access_token' } })
    service['setAccessToken'] = vi.fn()
    return service
  }

  it('should set refresh token', async () => {
    const spotify = createService()
    await spotify['refreshToken']()
    expect(spotify['setRefreshToken']).toHaveBeenCalledWith('spotify_refresh_token')
  })

  it('should refresh token', async () => {
    const spotify = createService()
    await spotify['refreshToken']()
    expect(spotify['refreshAccessToken']).toHaveBeenCalledWith()
  })

  it('should set access token', async () => {
    const spotify = createService()
    await spotify['refreshToken']()
    expect(spotify['setAccessToken']).toHaveBeenCalledWith('access_token')
  })

  it('should log success', async () => {
    const spotify = createService()
    const { success } = mockAction(spotify['logger'])
    await spotify['refreshToken']()
    expect(success).toHaveBeenCalledWith()
  })

  it('should log failure and throw', async () => {
    const spotify = createService()
    const { failure } = mockAction(spotify['logger'])
    spotify['refreshAccessToken'] = vi.fn().mockRejectedValue(new Error('500'))
    await expect(spotify['refreshToken']()).rejects.toThrow(new Error('500'))
    expect(failure).toHaveBeenCalledWith(new Error('500'))
  })
})

describe('fetchPlaylist', () => {
  function createService() {
    const service = new SpotifyService()
    service['logger'] = new MockedLogger()
    service['getTracksBatch'] = vi.fn().mockResolvedValue({ playlist: ['id1'], expected: 1 })
    return service
  }

  it('should get in memory playlist', async () => {
    const spotify = createService()
    spotify['inMemoryPlaylist'] = ['id12']
    const result = await spotify['fetchPlaylist']()
    expect(result).toEqual(['id12'])
  })

  it('should get playlist tracks by batch if no in memory playlist', async () => {
    const spotify = createService()
    await spotify['fetchPlaylist']()
    expect(spotify['getTracksBatch']).toHaveBeenCalledWith()
  })

  it('should log success and return fetched playlist', async () => {
    const spotify = createService()
    const { success } = mockAction(spotify['logger'])
    const result = await spotify['fetchPlaylist']()
    expect(success).toHaveBeenCalledWith({ nbTracks: 1, expected: 1 })
    expect(result).toEqual(['id1'])
  })

  it('should log failure and throw', async () => {
    const spotify = createService()
    const { failure } = mockAction(spotify['logger'])
    spotify['getTracksBatch'] = vi.fn().mockRejectedValue(new Error('500'))
    await expect(spotify['fetchPlaylist']()).rejects.toThrow(new Error('500'))
    expect(failure).toHaveBeenCalledWith(new Error('500'))
  })
})

describe('getTracksBatch', () => {
  function createService() {
    const service = new SpotifyService()
    service['logger'] = new MockedLogger()
    service['getPlaylistTracks'] = vi
      .fn()
      .mockResolvedValueOnce({ body: { items: [{ track: { id: null } }], next: true, total: 2 } })
      .mockResolvedValueOnce({ body: { items: [{ track: { id: 'id1' } }], next: true, total: 2 } })
      .mockResolvedValue({ body: { items: [{ track: { id: 'id2' } }], next: null, total: 2 } })
    return service
  }

  beforeEach(() => {
    vi.spyOn(utils, 'wait').mockImplementation(() => Promise.resolve())
  })

  it('should get playlist tracks by batch and log success', async () => {
    const spotify = createService()
    const { success } = mockAction(spotify['logger'])
    await spotify['getTracksBatch']()
    expect(spotify['getPlaylistTracks']).toHaveBeenCalledWith('playlist', {
      limit: 100,
      offset: 0,
      fields: 'total, next, limit, offset, items(track(id))',
    })
    expect(spotify['getPlaylistTracks']).toHaveBeenCalledTimes(3)
    expect(success).toHaveBeenCalledTimes(3)
    expect(success).toHaveBeenCalledWith()
  })

  it('should log and retry on spotify server error', async () => {
    const spotify = createService()
    const { failure } = mockAction(spotify['logger'])
    spotify['getPlaylistTracks'] = vi
      .fn()
      .mockRejectedValueOnce(new Error('WebapiRegularError: Request timed out'))
      .mockResolvedValue({ body: { items: [{ track: { id: 'id2' } }], next: null, total: 2 } })
    await spotify['getTracksBatch']()
    expect(spotify['getPlaylistTracks']).toHaveBeenCalledWith('playlist', {
      limit: 100,
      offset: 0,
      fields: 'total, next, limit, offset, items(track(id))',
    })
    expect(spotify['getPlaylistTracks']).toHaveBeenCalledTimes(2)
    expect(failure).toHaveBeenCalledWith(new Error('WebapiRegularError: Request timed out'))
  })

  it('should retry up to 10 times before throwing', async () => {
    const spotify = createService()
    const { failure } = mockAction(spotify['logger'])
    spotify['getPlaylistTracks'] = vi.fn().mockRejectedValue(new Error('WebapiRegularError: Request timed out'))
    await expect(spotify['getTracksBatch']()).rejects.toThrow()
    expect(failure).toHaveBeenCalledTimes(10)
  })

  it('should log and throw on other error', async () => {
    const spotify = createService()
    const { failure } = mockAction(spotify['logger'])
    spotify['getPlaylistTracks'] = vi.fn().mockRejectedValueOnce(new Error('500'))
    await expect(spotify['getTracksBatch']()).rejects.toThrow()
    expect(failure).toHaveBeenCalledWith(new Error('500'))
  })

  it('should return the playlist', async () => {
    const spotify = createService()
    const result = await spotify['getTracksBatch']()
    expect(result).toEqual({ playlist: ['id1', 'id2'], expected: 2 })
  })
})
