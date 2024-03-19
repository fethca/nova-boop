import { ILogger, Logger } from '@fethcat/logger'
import { formatDate } from '../helpers/utils.js'
import { getLastUpdateDate, getTempDate, setLastUpdateDate } from '../services/redis.js'
import { Message, settings } from '../settings.js'
import { NovaJob } from './nova.js'
import { SpotifyJob } from './spotify.js'

const { instanceId, logs, metadata } = settings

export class MainJob {
  protected logger: ILogger<Message> = Logger.create<Message>(instanceId, logs, metadata)

  async run(): Promise<void> {
    const { success, failure } = this.logger.action('main_job')
    try {
      const storedDate = await getLastUpdateDate(this.logger.child())
      const from = formatDate(storedDate).utcOffset('+02:00')
      const songs = await new NovaJob().run(from)
      if (songs.length) {
        await new SpotifyJob().run(songs)
        await setLastUpdateDate(getTempDate())
      }
      setTimeout(this.run.bind(this), 1000 * 60 * 30)
      success()
    } catch (error) {
      failure({ error })
      throw error
    }
  }
}
