import { extractPackageJson } from '@fethcat/shared'
import { logsValidators, redisValidators, validateEnv } from '@fethcat/validator'
import { randomBytes } from 'crypto'
import { num, str } from 'envalid'

const { name, version } = extractPackageJson()

const env = validateEnv({
  ...logsValidators,
  ...redisValidators,
  PORT: num({ default: 3000 }),
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
  metadata: { app: name, version, port: env.PORT, env: env.APP_STAGE },
  logs: {
    silent: env.LOG_SILENT,
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
  'main_job',
  'nova_extract',
  'nova_fetch_items',
  'nova_load_more',
  'nova_scrapping',
  'nova_scrapping_day',
  'process_items',
  'puppeteer_browser_disconnected',
  'puppeteer_create_page',
  'puppeteer_run_browser',
  'puppeteer_stop_browser',
  'redis_init_store',
  'redis_no_date_found',
  'redis_no_date_found_using_now',
  'redis_resetting_server_date',
  'redis_resetting_server_date',
  'redis_update_date',
  'spotify_connect',
  'spotify_get_playlist',
  'spotify_handle_songs',
  'spotify_upload_batch',
  'spotify_upload_songs',
  'spotify_search_song',
  'spotify_match_track_score',
] as const

export type Message = (typeof messages)[number]
