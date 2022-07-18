import { formatType, LoggerOptions } from '@src/logger'
import { bool, cleanEnv, host, num, port, str, ValidatorSpec } from 'envalid'

type BaseEnv = { APP_STAGE: string }

type RedisEnv = {
  REDIS_HOST: string
  REDIS_PORT: number
  REDIS_PASSWORD: string
  REDIS_CACHE_DURATION: number
}

type LogsEnv = { LOG_COLORIZE: boolean; LOG_SILENT: boolean; LOG_FORMAT: LoggerOptions['format'] }

const baseValidators: Validators<BaseEnv> = {
  APP_STAGE: str({ choices: ['local', 'dev', 'qa', 'preprod', 'prod', 'test'] }),
}

export const redisValidators: Validators<RedisEnv> = {
  REDIS_HOST: host({ default: undefined }),
  REDIS_PORT: port({ default: 6379 }),
  REDIS_PASSWORD: str({ default: undefined }),
  REDIS_CACHE_DURATION: num({ default: 3600 * 24 }),
}

export const logsValidators: Validators<LogsEnv> = {
  LOG_COLORIZE: bool({ default: false }),
  LOG_SILENT: bool({ default: false }),
  LOG_FORMAT: formatType({ default: 'json' }),
}

export type Validators<T> = { [K in keyof T]: ValidatorSpec<T[K]> }

export function validateEnv<T>(validators: Validators<T>): Readonly<T & BaseEnv> {
  return {
    ...cleanEnv<T>(process.env, validators),
    ...cleanEnv<BaseEnv>(process.env, baseValidators),
  }
}
