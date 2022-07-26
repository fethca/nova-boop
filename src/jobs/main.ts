import { formatDate } from '@src/helpers/formatDate'
import { ILogger } from '@src/logger'
import { redisStore } from '@src/services/redis'
import { Message, settings } from '@src/settings'
import { NovaJob } from './nova'

const LAST_UPDATE_KEY = 'last-update'

export class MainJob {
  constructor(private logger: ILogger<Message>) {}

  async run(): Promise<void> {
    const to = Date.now() - settings.refresh.offset
    const from = await this.getLastUpdateDate()
    const fromDate = formatDate(from)
    const toDate = formatDate(to + 1000)
    const { success, failure } = this.logger.action('process_item')
    try {
      await new NovaJob(this.logger.child()).fetchItems(fromDate, toDate)
      await this.updateDate(to)
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

  private async updateDate(date: number): Promise<void> {
    const newDate = formatDate(date)
    const { success, failure } = this.logger.action('redis_update_date')
    try {
      await this.setLastUpdateDate(date)
      success({ newDate })
    } catch (error) {
      failure(error)
    }
  }

  private async fetchItems(fromDate: string, toDate: string): Promise<void> {
    const filter = {
      // updated: [{ operator: 'BETWEEN', value: [fromDate, toDate] }],
      // brand: [{ operator: 'IN', value: settings.brandsWhitelist }],
    }
  }
}
