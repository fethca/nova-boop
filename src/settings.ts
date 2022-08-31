import { randomBytes } from 'crypto'
import { num, str } from 'envalid'
import { name, version } from '../package.json'
import { logsValidators, redisValidators, validateEnv } from './modules/envalid'

const env = validateEnv({
  ...logsValidators,
  ...redisValidators,
  SPOTIFY_ID: str(),
  SPOTIFY_SECRET: str(),
  SPOTIFY_PLAYLIST: str(),
  SPOTIFY_REFRESH_TOKEN: str(),
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
    playlist: env.SPOTIFY_PLAYLIST,
    refresh_token: env.SPOTIFY_REFRESH_TOKEN,
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
  'nova_extract',
  'nova_fetch_items',
  'nova_load_more',
  'nova_scrapping_day',
  'nova_scrapping',
  'process_item',
  'puppeteer_browser_disconnected',
  'puppeteer_create_page',
  'puppeteer_run_browser',
  'puppeteer_stop_browser',
  'redis_no_date_found',
  'redis_no_date_found_using_now',
  'redis_resetting_server_date',
  'redis_resetting_server_date',
  'redis_update_date',
  'spotify_connect',
  'spotify_handle_songs',
  'spotify_get_playlist',
  'spotify_upload_songs',
] as const

export type Message = typeof messages[number]
