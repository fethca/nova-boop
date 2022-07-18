import { randomBytes } from 'crypto'
import winston from 'winston'
import Transport from 'winston-transport'
import { AppParser } from './parsers/app'
import { ErrorParser, ForwardedError } from './parsers/error'
import { Parser } from './parsers/parser'
import { consoleTransport, fileTransport } from './transports'
import { ActionRecord, ActionResult, IAction, IActions, ILogger, LoggerOptions, Message } from './types'

export const defaultParsers: Record<string, Parser> = {
  default: new Parser(),
  app: new AppParser(),
  error: new ErrorParser(),
}

export class Logger<T extends string = ''> implements ILogger<T> {
  private parsers = defaultParsers
  private jobId: string

  static create<T extends string = ''>(instanceId: string, options: LoggerOptions = {}, meta = {}): ILogger<T> {
    const logger = winston.createLogger({ silent: options.silent })
    logger.add(consoleTransport(options))
    if (options.file) logger.add(fileTransport(options))
    return new Logger(instanceId, logger, meta)
  }

  constructor(private instanceId: string, private logger: winston.Logger, private meta: Record<string, unknown>) {
    this.jobId = randomBytes(16).toString('hex')
    this.addMeta(this.meta)
  }

  private formatMeta(meta?: Record<string, unknown>, actionId?: string): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries({ ...this.meta, ...meta })) {
      const parser = this.parsers[key] || this.parsers.default
      result[key] = parser.parse(value)
    }
    result.trace = { instanceId: this.instanceId, jobId: this.jobId, actionId, logId: randomBytes(16).toString('hex') }
    return result
  }

  child(): Logger<T> {
    return new Logger<T>(this.instanceId, this.logger.child({}), this.meta)
  }

  setParser<U extends Record<string, unknown>>(name: string, parser: Parser<U>): void {
    this.parsers[name] = parser
  }

  addMeta(meta: Record<string, unknown>): void {
    this.meta = { ...this.meta, ...meta }
  }

  switchTransport(transport: Transport): void {
    if (this.logger.transports.length > 1) {
      this.logger.remove(this.logger.transports[1])
    }
    this.logger.add(transport)
  }

  action(message: Message<T>, meta?: Record<string, unknown>): IAction {
    const actionId = randomBytes(16).toString('hex')
    this.logger.info(message, this.formatMeta(meta, actionId))
    return {
      success: (successMeta?: Record<string, unknown>) => {
        this.logger.info(`${message}_success`, this.formatMeta({ ...meta, ...successMeta }, actionId))
      },
      failure: (error: unknown, failureMeta?: Record<string, unknown>) => {
        this.logger.error(`${message}_failure`, this.formatMeta({ ...meta, ...failureMeta, error }, actionId))
        return new ForwardedError(message, error)
      },
    }
  }

  actions(message: Message<T>, records: ActionRecord[]): IActions {
    const actionId = randomBytes(16).toString('hex')
    const actionsMeta: Record<string, Record<string, unknown> | undefined> = {}
    for (const { id, meta } of records) {
      this.logger.info(message, this.formatMeta(meta, actionId))
      actionsMeta[id] = meta
    }
    return {
      end: (results: ActionResult[]) => {
        for (const { id, meta, error } of results) {
          if (error) {
            this.logger.error(`${message}_failure`, this.formatMeta({ ...actionsMeta[id], ...meta, error }, actionId))
          } else {
            this.logger.info(`${message}_success`, this.formatMeta({ ...actionsMeta[id], ...meta }, actionId))
          }
        }
      },
    }
  }

  info(message: Message<T>, meta?: Record<string, unknown>): void {
    this.logger.info(message, this.formatMeta(meta))
  }

  warn(message: Message<T>, meta?: Record<string, unknown>): void {
    this.logger.warn(message, this.formatMeta(meta))
  }

  error(message: Message<T>, meta?: Record<string, unknown>): void {
    this.logger.error(message, this.formatMeta(meta))
  }
}
