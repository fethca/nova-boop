import { formatDate } from '@src/helpers/formatDate'
import { ILogger } from '@src/logger'
import { Message } from '@src/settings'
import { getLastUpdateDate } from '@src/store'
import { NovaJob } from './nova'
import { SpotifyJob } from './spotify'

const LAST_UPDATE_KEY = 'last-update'

export class MainJob {
  constructor(private logger: ILogger<Message>) {}

  async run(): Promise<void> {
    const { success, failure } = this.logger.action('process_items')
    try {
      const storedDate = await getLastUpdateDate(this.logger.child())
      const from = formatDate(storedDate).utcOffset('+02:00')
      const songs = await new NovaJob(this.logger.child()).run(from)
      await new SpotifyJob(this.logger.child()).run(songs)
      setTimeout(this.run.bind(this), 1800000)
      success()
    } catch (error) {
      failure({ error })
      throw error
    }
  }
}
