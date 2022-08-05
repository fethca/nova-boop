import { Message } from '@src/settings'
import { ILogger } from '../logger'
import { redisStore } from './../services/redis'

const LAST_UPDATE_KEY = 'last-update'

export async function getLastUpdateDate(logger: ILogger<Message>): Promise<number> {
  let date = Number(await redisStore.get(LAST_UPDATE_KEY))
  if (!date) {
    date = Date.now()
    await setLastUpdateDate(date)
    logger.info('redis_no_date_found_using_now')
    return date
  }

  const inMemoryDate = Number(await redisStore.localInstance.get(LAST_UPDATE_KEY))
  if (inMemoryDate && inMemoryDate > date) {
    date = inMemoryDate
    logger.info('redis_resetting_server_date')
    await setLastUpdateDate(inMemoryDate)
    redisStore.localInstance.del(LAST_UPDATE_KEY)
  }
  return date
}

export function setLastUpdateDate(timestamp: number): Promise<void> {
  return redisStore.set(LAST_UPDATE_KEY, timestamp.toString())
}
