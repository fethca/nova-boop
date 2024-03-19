import { Logger } from '@fethcat/logger'
import { wait } from './helpers/utils.js'
import { MainJob } from './jobs/main.js'
import { store } from './services/redis.js'
import { connectSpotify } from './services/spotify.js'
import { Message, settings } from './settings.js'

const { instanceId, logs, metadata } = settings

export class App {
  logger = Logger.create<Message>(instanceId, logs, metadata)

  async run(): Promise<void> {
    const { success, failure } = this.logger.action('app_start')
    try {
      await wait(2000)
      await this.initRedis()
      await this.initSpotify()
      new MainJob().run()
      process.on('SIGTERM', this.exit.bind(this))
      success()
    } catch (error) {
      failure(error)
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
      await connectSpotify()
      success()
    } catch (error) {
      throw failure(error)
    }
  }

  private async exit() {
    this.logger.info('app_stop')
  }
}
