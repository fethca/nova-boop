import { bool, makeValidator, str, url } from 'envalid'
import { Validators } from '../modules/envalid'
import { LoggerOptions } from './types'

export const formatType = makeValidator<LoggerOptions['format']>((input: string) => {
  if (input === 'json' || input === 'simple') return input
  throw new Error(`Value "${input}" shoud be either "json" or "simple"`)
})

type LogsEnv = {
  LOG_COLORIZE: boolean
  LOG_SILENT: boolean
  LOG_FORMAT: LoggerOptions['format']
}

export const logsValidators: Validators<LogsEnv> = {
  LOG_COLORIZE: bool({ default: false }),
  LOG_SILENT: bool({ default: false }),
  LOG_FORMAT: formatType({ default: 'json' }),
}

type ApmEnv = {
  APM_SECRET: string
  APM_SERVER_URL: string
}

export const apmValidators: Validators<ApmEnv> = {
  APM_SECRET: str({ default: undefined }),
  APM_SERVER_URL: url({ default: undefined }),
}
