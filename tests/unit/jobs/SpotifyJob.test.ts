import { MockedLogger, mockAction } from '@fethcat/logger'
import { SpotifyJob } from '../../../src/jobs/SpotifyJob.js'
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

  it('should log success', async () => {
    const job = createJob()
    const { success } = mockAction(job['logger'])
    await job.run([mockTrack()])
    expect(success).toHaveBeenCalledWith()
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
