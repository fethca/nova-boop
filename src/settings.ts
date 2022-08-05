import { randomBytes } from 'crypto'
import { num, str } from 'envalid'
import { name, version } from '../package.json'
import { logsValidators, redisValidators, validateEnv } from './modules/envalid'

const env = validateEnv({
  ...logsValidators,
  ...redisValidators,
  SPOTIFY_ID: str(),
  SPOTIFY_SECRET: str(),
  REFRESH_INTERVAL: num({ default: 1000 * 60 }),
  REFRESH_OFFSET: num({ default: 1000 * 15 }),
})

const instanceId = randomBytes(16).toString('hex')

export const settings = {
  instanceId,
  app: { name, version },
  logs: {
    common: {
      app: name,
      file: name,
      colorize: env.LOG_COLORIZE,
      silent: env.LOG_SILENT,
      format: env.LOG_FORMAT,
    },
  },
  spotify: {
    id: env.SPOTIFY_ID,
    secret: env.SPOTIFY_SECRET,
  },
  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    keyPrefix: `${name}:`,
    cacheDuration: env.REDIS_CACHE_DURATION,
  },
  refresh: { interval: env.REFRESH_INTERVAL, offset: env.REFRESH_OFFSET },
}

const messages = [
  'process_item',
  'get_nova_list',
  'connect_spotify',
  'redis_no_date_found',
  'redis_resetting_server_date',
  'redis_update_date',
  'nova_fetch_items',
  'nova_scrapping',
  'nova_load_more',
  'redis_no_date_found_using_now',
  'redis_resetting_server_date',
  'in_here',
] as const

export type Message = typeof messages[number]
