import { formatDate } from '@src/helpers/formatDate'
import { ILogger } from '@src/logger'
import { redisStore } from '@src/services/redis'
import { Message, settings } from '@src/settings'
import { getLastUpdateDate, setLastUpdateDate } from '@src/store'
import { SpotifyJob } from './spotify'

const LAST_UPDATE_KEY = 'last-update'

export class MainJob {
  constructor(private logger: ILogger<Message>) {}

  async run(): Promise<void> {
    const to = Date.now() - settings.refresh.offset
    const from = await this.getLastUpdateDate()
    const { success, failure } = this.logger.action('process_item')
    try {
      const storedDate = await getLastUpdateDate(this.logger.child())
      const from = formatDate(storedDate)
      // const songs = await new NovaJob(this.logger.child()).run(from)
      const songs = ['6igsoAR6Co9u7Rq3U7mlOD']
      await new SpotifyJob(this.logger.child()).run(songs)
      success()
    } catch (error) {
      failure({ error })
      throw error
    }
  }

  private async getLastUpdateDate(): Promise<number> {
    let date = Number(await redisStore.get(LAST_UPDATE_KEY))
    if (!date) {
      date = Date.now()
      await this.setLastUpdateDate(date)
      this.logger.info('redis_no_date_found')
      return date
    }

    const inMemoryDate = Number(await redisStore.localInstance.get(LAST_UPDATE_KEY))
    if (inMemoryDate && inMemoryDate > date) {
      date = inMemoryDate
      this.logger.info('redis_resetting_server_date')
      await this.setLastUpdateDate(inMemoryDate)
      redisStore.localInstance.del(LAST_UPDATE_KEY)
    }
    return date
  }

  private async setLastUpdateDate(timestamp: number): Promise<void> {
    return redisStore.set(LAST_UPDATE_KEY, timestamp.toString())
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
