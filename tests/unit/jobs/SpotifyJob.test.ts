import { MockedLogger, mockAction } from '@fethcat/logger'
import { SpotifyJob } from '../../../src/jobs/SpotifyJob.js'
import { spotifyService } from '../../../src/services.js'
import { mockTrack } from '../../mock.js'

describe('run', () => {
  function createJob() {
    const job = new SpotifyJob()
    job['logger'] = new MockedLogger()
    job['getId'] = vi.fn().mockResolvedValue('trackId')
    job['getPlaylist'] = vi.fn().mockResolvedValue(['id12', 'id72'])
    job['uploadTracks'] = vi.fn()
    return job
  }

  it('should get id of each track', async () => {
    const job = createJob()
    await job.run([mockTrack(), mockTrack({ title: 'track2' })])
    expect(job['getId']).toHaveBeenCalledWith(mockTrack())
    expect(job['getId']).toHaveBeenCalledWith(mockTrack({ title: 'track2' }))
  })

  it('should get the spotify playlist', async () => {
    const job = createJob()
    await job.run([mockTrack()])
    expect(job['getPlaylist']).toHaveBeenCalledWith()
  })

  it('should upload the tracks to playlist', async () => {
    const job = createJob()
    await job.run([mockTrack()])
    expect(job['uploadTracks']).toHaveBeenCalledWith(['trackId'], ['id12', 'id72'])
  })

  it('should skip tracks without id', async () => {
    const job = createJob()
    job['getId'] = vi.fn().mockResolvedValueOnce(null).mockResolvedValue('trackId')
    await job.run([mockTrack(), mockTrack()])
    expect(job['uploadTracks']).toHaveBeenCalledWith(['trackId'], ['id12', 'id72'])
  })

  it('should log success and return true', async () => {
    const job = createJob()
    const { success } = mockAction(job['logger'])
    const result = await job.run([mockTrack()])
    expect(success).toHaveBeenCalledWith()
    expect(result).toBe(true)
  })

  it('should log failure', async () => {
    const job = createJob()
    const { failure } = mockAction(job['logger'])
    job['uploadTracks'] = vi.fn().mockRejectedValue(new Error('500'))
    await job.run([mockTrack()])
    expect(failure).toHaveBeenCalledWith(new Error('500'))
  })
})

describe('getId', () => {
  function createJob() {
    const job = new SpotifyJob()
    job['searchTrack'] = vi.fn().mockResolvedValue('searchTrackId')
    return job
  }

  it("should return the spotifyId if it's in the scrapped track", async () => {
    const job = createJob()
    const result = await job['getId'](mockTrack({ spotifyId: 'spotifyId' }))
    expect(result).toBe('spotifyId')
  })

  it('should search the track if the spotifyId is not in the scrapped track', async () => {
    const job = createJob()
    await job['getId'](mockTrack({ spotifyId: undefined }))
    expect(job['searchTrack']).toHaveBeenCalledWith('artist', 'title')
  })

  it('should return the searched track id', async () => {
    const job = createJob()
    const result = await job['getId'](mockTrack({ spotifyId: undefined }))
    expect(result).toBe('searchTrackId')
  })
})

describe('searchTrack', () => {
  function createJob() {
    const job = new SpotifyJob()
    job['logger'] = new MockedLogger()
    return job
  }

  beforeEach(() => {
    spotifyService.searchTracks = vi.fn().mockResolvedValue({
      body: { tracks: { items: [{ artists: [{ name: 'artist' }], name: 'searchedTrack', id: 'id' }] } },
    })
  })

  it('should search tracks with cleaned title', async () => {
    const job = createJob()
    await job['searchTrack']('artist', 'Tïtlè (feat. artist)')
    expect(spotifyService.searchTracks).toHaveBeenCalledWith('track:title artist:artist', { limit: 3 })
  })

  it('should search tracks for each artist', async () => {
    const job = createJob()
    await job['searchTrack']('artist1/artist2', 'title')
    expect(spotifyService.searchTracks).toHaveBeenCalledWith('track:title artist:artist1', { limit: 3 })
    expect(spotifyService.searchTracks).toHaveBeenCalledWith('track:title artist:artist2', { limit: 3 })
  })

  it('should search tracks with two different patterns', async () => {
    const job = createJob()
    await job['searchTrack']('artist', 'title')
    expect(spotifyService.searchTracks).toHaveBeenCalledWith('track:title artist:artist', { limit: 3 })
    expect(spotifyService.searchTracks).toHaveBeenCalledWith('title artist', { limit: 3 })
  })

  it('should stop loop if one pattern has a result', async () => {
    const job = createJob()
    await job['searchTrack']('artist', 'searchedTrack')
    expect(spotifyService.searchTracks).toHaveBeenCalledWith('track:searchedtrack artist:artist', { limit: 3 })
    expect(spotifyService.searchTracks).toHaveBeenCalledTimes(1)
    expect(spotifyService.searchTracks).not.toHaveBeenCalledWith('searchedTrack artist', { limit: 3 })
  })

  it('should log skip and return null if no track found', async () => {
    spotifyService.searchTracks = vi.fn().mockResolvedValue({ body: { tracks: { items: [] } } })
    const job = createJob()
    const { skip } = mockAction(job['logger'])
    const result = await job['searchTrack']('artist', 'searchedTrack')
    expect(skip).toHaveBeenCalledWith('spotify_no_match')
    expect(result).toBeNull()
  })

  it('should log success and return found track id', async () => {
    const job = createJob()
    const { success } = mockAction(job['logger'])
    const result = await job['searchTrack']('artist', 'searchedTrack')
    expect(success).toHaveBeenCalledWith()
    expect(result).toBe('id')
  })

  it('should log failure and return null', async () => {
    const job = createJob()
    const { failure } = mockAction(job['logger'])
    spotifyService.searchTracks = vi.fn().mockRejectedValue(new Error('500'))
    const result = await job['searchTrack']('artist', 'searchedTrack')
    expect(failure).toHaveBeenCalledWith(new Error('500'))
    expect(result).toBeNull()
  })
})

describe('getPlaylist', () => {
  function createJob() {
    const job = new SpotifyJob()
    job['logger'] = new MockedLogger()
    job['getTracksBatch'] = vi.fn().mockResolvedValue({ playlist: [mockTrack()], expected: 1 })
    return job
  }

  it('should get playlist tracks by batch', async () => {
    const job = createJob()
    await job['getPlaylist']()
    expect(job['getTracksBatch']).toHaveBeenCalledWith()
  })

  it('should log success and return playlist', async () => {
    const job = createJob()
    const { success } = mockAction(job['logger'])
    const result = await job['getPlaylist']()
    expect(success).toHaveBeenCalledWith({ nbTracks: 1, expected: 1 })
    expect(result).toEqual([mockTrack()])
  })

  it('should log failure and throw', async () => {
    const job = createJob()
    const { failure } = mockAction(job['logger'])
    job['getTracksBatch'] = vi.fn().mockRejectedValue(new Error('500'))
    await expect(job['getPlaylist']()).rejects.toThrow(new Error('500'))
    expect(failure).toHaveBeenCalledWith(new Error('500'))
  })
})

describe('getTracksBatch', () => {
  beforeEach(() => {
    spotifyService.getPlaylistTracks = vi
      .fn()
      .mockResolvedValueOnce({ body: { items: [{ track: { id: null } }], next: true, total: 2 } })
      .mockResolvedValueOnce({ body: { items: [{ track: { id: 'id1' } }], next: true, total: 2 } })
      .mockResolvedValue({ body: { items: [{ track: { id: 'id2' } }], next: null, total: 2 } })
  })

  it('should get playlist tracks by batch', async () => {
    const job = new SpotifyJob()
    await job['getTracksBatch']()
    expect(spotifyService.getPlaylistTracks).toHaveBeenCalledWith('playlist', {
      limit: 100,
      offset: 0,
      fields: 'total, next, limit, offset, items(track(id))',
    })
    expect(spotifyService.getPlaylistTracks).toHaveBeenCalledTimes(3)
  })

  it('should return the playlist', async () => {
    const job = new SpotifyJob()
    const result = await job['getTracksBatch']()
    expect(result).toEqual({ playlist: ['id1', 'id2'], expected: 2 })
  })
})

describe('uploadTracks', () => {
  function createJob() {
    const job = new SpotifyJob()
    job['logger'] = new MockedLogger()
    job['uploadBatch'] = vi.fn()
    return job
  }

  it('should remove already existing tracks in playlist', async () => {
    const job = createJob()
    await job['uploadTracks'](['id2'], ['id1', 'id2'])
    expect(job['uploadBatch']).toHaveBeenCalledWith([{ uri: 'spotify:track:id2' }], expect.any(Function))
  })

  it('should add reorder and actual number of uploaded tracks to log metadatas', async () => {
    const job = createJob()
    await job['uploadTracks'](['id2'], ['id1', 'id2'])
    expect(job['logger'].addMeta).toHaveBeenCalledWith({ reorder: 1, upload: 0 })
  })

  it('should upload tracks', async () => {
    const job = createJob()
    await job['uploadTracks'](['id'], ['id1', 'id2'])
    expect(job['uploadBatch']).toHaveBeenCalledWith(['spotify:track:id'], expect.any(Function), { position: 0 })
  })

  it('should log success', async () => {
    const job = createJob()
    const { success } = mockAction(job['logger'])
    await job['uploadTracks'](['id'], ['id1', 'id2'])
    expect(success).toHaveBeenCalledWith()
  })

  it('should log failure', async () => {
    const job = createJob()
    const { failure } = mockAction(job['logger'])
    job['uploadBatch'] = vi.fn().mockRejectedValue(new Error('500'))
    await job['uploadTracks'](['id'], ['id1', 'id2'])
    expect(failure).toHaveBeenCalledWith(new Error('500'))
  })
})

describe('uploadBatch', () => {
  function createJob() {
    const job = new SpotifyJob()
    job['logger'] = new MockedLogger()
    return job
  }

  it('should call upload given function in batches of 100', async () => {
    const job = createJob()
    const fn = vi.fn()
    await job['uploadBatch'](['id1', ...Array(100).fill('id'), 'id102'], fn, { option: 'option' })
    expect(fn).toHaveBeenCalledWith('playlist', [...Array(99).fill('id'), 'id102'], { option: 'option' })
    expect(fn).toHaveBeenCalledWith('playlist', ['id1', 'id'], { option: 'option' })
  })

  it('should log success', async () => {
    const job = createJob()
    const fn = vi.fn()
    const { success } = mockAction(job['logger'])
    await job['uploadBatch'](['id'], fn, { option: 'option' })
    expect(success).toHaveBeenCalledWith()
  })

  it('should log failure', async () => {
    const job = createJob()
    const fn = vi.fn().mockRejectedValue(new Error('500'))
    const { failure } = mockAction(job['logger'])
    await job['uploadBatch'](['id'], fn, { option: 'option' })
    expect(failure).toHaveBeenCalledWith(new Error('500'))
  })
})
