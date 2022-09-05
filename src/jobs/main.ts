import { formatDate } from '@src/helpers/formatDate'
import { ILogger } from '@src/logger'
import { Message } from '@src/settings'
import { getLastUpdateDate, setLastUpdateDate } from '@src/store'
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
      success()
      setTimeout(this.run, 1800000)
    } catch (error) {
      failure({ error })
      throw error
    }
  }

  async updateDate(date: number): Promise<void> {
    const newDate = formatDate(date)
    const { success, failure } = this.logger.action('redis_update_date', { newDate })
    try {
      await setLastUpdateDate(date)
      success()
    } catch (error) {
      failure(error)
    }
  }
}
