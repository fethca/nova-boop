import { Logger } from '@fethcat/logger'
import { MainJob } from './jobs/MainJob.js'
import { spotifyService, store } from './services/services.js'
import { Message, settings } from './settings.js'

const { instanceId, logs, metadata } = settings

export class App {
  logger = Logger.create<Message>(instanceId, logs, metadata)

  async run(): Promise<void> {
    const { success, failure } = this.logger.action('app_start')
    try {
      await this.initRedis()
      await this.initSpotify()
      void new MainJob().run()
      process.on('SIGTERM', this.exit.bind(this))
      success()
    } catch (error) {
      failure(error)
      process.exit(1)
    }
  }

  private async initRedis() {
    const { success, failure } = this.logger.action('redis_init_store')
    try {
      await store.initClient(settings.redis)
      success()
    } catch (error) {
      throw failure(error)
    }
  }

  private async initSpotify() {
    const { success, failure } = this.logger.action('spotify_connect')
    try {
      await spotifyService.refreshToken()
      await spotifyService.fetchPlaylist()
      success()
    } catch (error) {
      throw failure(error)
    }
  }

  private exit() {
    this.logger.info('app_stop')
  }
}
