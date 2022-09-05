import RedisStore, { BooleanResponse, Redis, RedisOptions } from 'ioredis'
import RedisLocal from 'ioredis-mock'

export class Store {
  localInstance: Redis
  redisInstance?: Redis
  tempDate: string = ''

  constructor() {
    this.localInstance = new RedisLocal()
  }

  async initClient(redisOptions: RedisOptions): Promise<void> {
    this.redisInstance = new RedisStore({ ...redisOptions, lazyConnect: true })
    return this.redisInstance.connect()
  }

  async get(key: string): Promise<string | null> {
    if (this.redisInstance) {
      return this.redisInstance.get(key).catch(() => this.localInstance.get(key))
    }
    return this.localInstance.get(key)
  }

  async set(key: string, value: string, time?: number): Promise<void> {
    const options = time !== undefined ? ['EX', time.toString()] : []
    if (this.redisInstance) {
      await this.redisInstance.set(key, value, ...options).catch(() => undefined)
    }
    await this.localInstance.set(key, value, ...options)
  }

  async expire(key: string, time: number): Promise<BooleanResponse> {
    if (this.redisInstance) {
      return this.redisInstance.expire(key, time).catch(() => this.localInstance.expire(key, time))
    }
    return this.localInstance.expire(key, time)
  }

  async incr(key: string, time = 3600): Promise<number> {
    let count = 0
    if (this.redisInstance) {
      count = await this.redisInstance.incr(key).catch(() => this.localInstance.incr(key))
    } else {
      count = await this.localInstance.incr(key)
    }
    if (count === 1) {
      await this.expire(key, time)
    }
    return count
  }
}
