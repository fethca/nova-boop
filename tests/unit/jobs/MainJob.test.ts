import { MockedLogger, mockAction } from '@fethcat/logger'
import mockdate from 'mockdate'
import { setTempDate } from '../../../src/helpers/redis.js'
import { MainJob } from '../../../src/jobs/MainJob.js'
import { NovaJob } from '../../../src/jobs/NovaJob.js'
import { SpotifyJob } from '../../../src/jobs/SpotifyJob.js'
import { store } from '../../../src/services.js'
import { mockTrack } from '../../mock.js'

vi.mock('../../../src/jobs/NovaJob')
vi.mock('../../../src/jobs/SpotifyJob')

mockdate.set(1711014631)

describe('run', () => {
  function createJob() {
    const job = new MainJob()
    job['logger'] = new MockedLogger()
    job['getLastUpdateDate'] = vi.fn()
    job['setLastUpdateDate'] = vi.fn()
    return job
  }

  beforeEach(() => {
    vi.useRealTimers()
    store.get = vi.fn().mockResolvedValue(1710950044)
    setTempDate('03/20/2024', '12:12')
    NovaJob.prototype.run = vi.fn().mockResolvedValue([mockTrack()])
  })

  it('should run scrappe job from last update date', async () => {
    const job = createJob()
    await job.run()
    expect(NovaJob.prototype.run).toHaveBeenCalled()
  })

  it('should run spotify job if songs have been scrapped', async () => {
    const job = createJob()
    await job.run()
    expect(SpotifyJob.prototype.run).toHaveBeenCalledWith([mockTrack()])
  })

  it('should loop', async () => {
    vi.useFakeTimers()
    vi.spyOn(MainJob.prototype, 'run')
    const job = createJob()
    await job.run()
    vi.advanceTimersToNextTimer()
    expect(MainJob.prototype.run).toHaveBeenCalledTimes(2)
  })

  it('should log success', async () => {
    const job = createJob()
    const { success } = mockAction(job['logger'])
    await job.run()
    expect(success).toHaveBeenCalledWith()
  })

  it('should log failure and throw', async () => {
    NovaJob.prototype.run = vi.fn().mockRejectedValue(new Error('500'))
    const job = createJob()
    const { failure } = mockAction(job['logger'])
    await expect(job.run()).rejects.toThrow(new Error('500'))
    expect(failure).toHaveBeenCalledWith(new Error('500'))
  })
})

describe('getLastUpdateDate', () => {
  function createJob() {
    const job = new MainJob()
    job['logger'] = new MockedLogger()
    job['setLastUpdateDate'] = vi.fn()
    return job
  }

  beforeEach(() => {
    store.get = vi.fn().mockResolvedValue('2000')
    store.localInstance.get = vi.fn().mockResolvedValue('1000')
  })

  it('should get last update date', async () => {
    const job = createJob()
    await job['getLastUpdateDate']()
    expect(store.get).toHaveBeenCalledWith('last-update')
  })

  it('should use now if no last update date was found', async () => {
    store.get = vi.fn().mockResolvedValue(null)
    const job = createJob()
    await job['getLastUpdateDate']()
    expect(job['setLastUpdateDate']).toHaveBeenCalledWith(1711014631)
    expect(job['logger'].info).toHaveBeenCalledWith('redis_no_stored_date')
  })

  it('should reset date if redis date is older than memory date', async () => {
    store.localInstance.get = vi.fn().mockResolvedValue('3000')
    const job = createJob()
    await job['getLastUpdateDate']()
    expect(job['setLastUpdateDate']).toHaveBeenCalledWith(3000)
    expect(job['logger'].info).toHaveBeenCalledWith('redis_reset_stored_date')
  })

  it('should return date', async () => {
    const job = createJob()
    const date = await job['getLastUpdateDate']()
    expect(date).toBe(2000)
  })

  it('should log success', async () => {
    const job = createJob()
    const { success } = mockAction(job['logger'])
    await job['getLastUpdateDate']()
    expect(success).toHaveBeenCalledWith({ date: 2000 })
  })

  it('should log failure and throw', async () => {
    store.get = vi.fn().mockRejectedValue(new Error('500'))
    const job = createJob()
    const { failure } = mockAction(job['logger'])
    await expect(job['getLastUpdateDate']()).rejects.toThrow(new Error('500'))
    expect(failure).toHaveBeenCalledWith(new Error('500'))
  })
})

describe('setLastUpdateDate', () => {
  function createJob() {
    const job = new MainJob()
    job['logger'] = new MockedLogger()
    return job
  }

  it('should store date as string', async () => {
    const job = createJob()
    await job['setLastUpdateDate'](1000)
    expect(store.set).toHaveBeenCalledWith('last-update', '1000')
  })

  it('should log success', async () => {
    const job = createJob()
    const { success } = mockAction(job['logger'])
    await job['setLastUpdateDate'](1000)
    expect(success).toHaveBeenCalledWith({ timestamp: 1000 })
  })

  it('should log failure and throw', async () => {
    const job = createJob()
    store.set = vi.fn().mockRejectedValue(new Error('500'))
    const { failure } = mockAction(job['logger'])
    await expect(job['setLastUpdateDate'](1)).rejects.toThrow(new Error('500'))
    expect(failure).toHaveBeenCalledWith(new Error('500'))
  })
})
