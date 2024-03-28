import { ILogger, Logger } from '@fethcat/logger'
import moment from 'moment'
import { getTempDate } from '../helpers/redis.js'
import { store } from '../services/services.js'
import { Message, settings } from '../settings.js'
import { NovaJob } from './NovaJob.js'
import { SpotifyJob } from './SpotifyJob.js'

const { instanceId, logs, metadata } = settings

export class MainJob {
  protected logger: ILogger<Message> = Logger.create<Message>(instanceId, logs, metadata)

  async run(): Promise<void> {
    const { success, failure } = this.logger.action('main_job')
    try {
      const storedDate = await this.getLastUpdateDate()
      const from = moment(storedDate).utc()
      const songs = await new NovaJob().run(from)
      if (songs.length) {
        const success = await new SpotifyJob().run(songs)
        if (success) await this.setLastUpdateDate(getTempDate())
      }
      setTimeout(this.run.bind(this), 1000 * 60 * 30)
      success()
    } catch (error) {
      failure(error)
      throw error
    }
  }

  private async getLastUpdateDate(): Promise<number> {
    const { success, failure } = this.logger.action('redis_get_last_update_date')
    try {
      let timestamp = Number(await store.get('last-update'))
      if (!timestamp) {
        timestamp = Date.now()
        await this.setLastUpdateDate(timestamp)
        this.logger.info('redis_no_stored_date')
      } else {
        const inMemoryDate = Number(store.localInstance.get('last-update'))
        if (inMemoryDate > timestamp) {
          timestamp = inMemoryDate
          this.logger.info('redis_reset_stored_date')
          await this.setLastUpdateDate(inMemoryDate)
          store.localInstance.delete('last-update')
        }
      }
      const date = moment(timestamp).utc().format('MM/DD/YYYY hh:mm z')
      success({ timestamp, date })
      return timestamp
    } catch (error) {
      throw failure(error)
    }
  }

  private async setLastUpdateDate(timestamp: number): Promise<void> {
    const { success, failure } = this.logger.action('redis_set_last_update_date')
    try {
      const date = moment(timestamp).utc().format('MM/DD/YYYY hh:mm z')
      await store.set('last-update', timestamp.toString())
      success({ timestamp, date })
    } catch (error) {
      throw failure(error)
    }
  }
}
