import { MainJob } from './jobs/main'
import { Logger } from './logger'
import { redisStore } from './services/redis'
import { spotifyService } from './services/spotify'
import { Message, settings } from './settings'

const { instanceId, app, logs } = settings

export class App {
  private logger = Logger.create<Message>(instanceId, logs.common, { app })

  async run(): Promise<void> {
    const { success, failure } = this.logger.action('app_start')
    try {
      await this.connectSpotify()
      await redisStore.initClient(settings.redis)
      new MainJob(this.logger.child()).run()
      process.on('SIGTERM', this.exit.bind(this))
      success()
    } catch (error) {
      failure(error)
    }
  }

  private async connectSpotify() {
    const { success, failure } = this.logger.action('connect_spotify')
    try {
      await spotifyService
        .clientCredentialsGrant()
        .then((data) => spotifyService.setAccessToken(data.body['access_token']))
        .catch((error) => {
          throw error
        })
      success()
    } catch (error) {
      failure(error)
    }
  }

  private async exit() {
    this.logger.info('app_stop')
  }
}
