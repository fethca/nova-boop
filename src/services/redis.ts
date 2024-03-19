import { ILogger } from '@fethcat/logger'
import { Store } from '@fethcat/store'
import moment from 'moment'
import { Message } from '../settings.js'

export const store = new Store()

let tempDate: number

const LAST_UPDATE_KEY = 'last-update'

export function getTempDate() {
  return tempDate
}

export function setTempDate(date: string, hour: string) {
  const dateFormat = 'MM/DD/YYYY HH:mm'
  tempDate = moment(`${date} ${hour}`, dateFormat).utcOffset('+02:00').valueOf()
}

export async function getLastUpdateDate(logger: ILogger<Message>): Promise<number> {
  let date = Number(await store.get(LAST_UPDATE_KEY))
  if (!date) {
    date = Date.now()
    await setLastUpdateDate(date)
    logger.info('redis_no_date_found_using_now')
    return date
  }

  const inMemoryDate = Number(await store.localInstance.get(LAST_UPDATE_KEY))
  if (inMemoryDate && inMemoryDate > date) {
    date = inMemoryDate
    logger.info('redis_resetting_server_date')
    await setLastUpdateDate(inMemoryDate)
    store.localInstance.delete(LAST_UPDATE_KEY)
  }
  return date
}

export function setLastUpdateDate(timestamp: number): Promise<void> {
  return store.set(LAST_UPDATE_KEY, timestamp.toString())
}
