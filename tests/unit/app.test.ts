import { MockedLogger, mockAction } from '@fethcat/logger'
import { App } from '../../src/app.js'
import { spotifyService, store } from '../../src/services.js'

vi.mock('../../src/jobs/MainJob')

describe('run', () => {
  function createApp() {
    const app = new App()
    app['logger'] = new MockedLogger()
    app['initRedis'] = vi.fn()
    app['initSpotify'] = vi.fn()
    app['exit'] = vi.fn()
    return app
  }

  beforeEach(() => {
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    vi.spyOn(process, 'on')
  })

  it('should init redis', async () => {
    const app = createApp()
    await app.run()
    expect(app['initRedis']).toHaveBeenCalled()
  })

  it('should init spotify', async () => {
    const app = createApp()
    await app.run()
    expect(app['initSpotify']).toHaveBeenCalled()
  })

  it('should register exit event', async () => {
    const app = createApp()
    await app.run()
    expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function))
  })

  it('should log success', async () => {
    const app = createApp()
    const { success } = mockAction(app['logger'])
    await app.run()
    expect(success).toHaveBeenCalled()
  })

  it('should log failure and exit process', async () => {
    const app = createApp()
    app['initRedis'] = vi.fn().mockRejectedValue(new Error('500'))
    const { failure } = mockAction(app['logger'])
    await app.run()
    expect(failure).toHaveBeenCalledWith(new Error('500'))
    expect(process.exit).toHaveBeenCalledWith(1)
  })
})

describe('initRedis', () => {
  it('should init client', async () => {
    const app = new App()
    app['logger'] = new MockedLogger()
    await app['initRedis']()
    expect(store.initClient).toHaveBeenCalledWith({
      cacheDuration: 86400,
      host: 'localhost',
      keyPrefix: 'nova-boop:',
      password: 'pwd',
      port: 6379,
    })
  })

  it('should log success', async () => {
    const app = new App()
    const { success } = mockAction(app['logger'])
    await app['initRedis']()
    expect(success).toHaveBeenCalled()
  })

  it('should log failure and throw', async () => {
    store.initClient = vi.fn().mockRejectedValue(new Error('500'))
    const app = new App()
    const { failure } = mockAction(app['logger'])
    await expect(app['initRedis']()).rejects.toThrow(new Error('500'))
    expect(failure).toHaveBeenCalledWith(new Error('500'))
  })
})

describe('initSpotify', () => {
  beforeEach(() => {
    spotifyService.refreshAccessToken = vi.fn().mockResolvedValue({ body: { access_token: 'token' } })
  })

  it('should set refresh token', async () => {
    const app = new App()
    app['logger'] = new MockedLogger()
    await app['initSpotify']()
    expect(spotifyService.setRefreshToken).toHaveBeenCalledWith('spotify_refresh_token')
  })

  it('should refresh access token', async () => {
    const app = new App()
    app['logger'] = new MockedLogger()
    await app['initSpotify']()
    expect(spotifyService.refreshAccessToken).toHaveBeenCalledWith()
  })

  it('should log success', async () => {
    const app = new App()
    const { success } = mockAction(app['logger'])
    await app['initSpotify']()
    expect(success).toHaveBeenCalled()
  })

  it('should log failure and throw', async () => {
    spotifyService.refreshAccessToken = vi.fn().mockRejectedValue(new Error('500'))
    const app = new App()
    const { failure } = mockAction(app['logger'])
    await expect(app['initSpotify']()).rejects.toThrow(new Error('500'))
    expect(failure).toHaveBeenCalledWith(new Error('500'))
  })
})

describe('exit', () => {
  it('should log', () => {
    const app = new App()
    app['logger'].info = vi.fn()
    app['exit']()
    expect(app['logger'].info).toHaveBeenCalledWith('app_stop')
  })
})
