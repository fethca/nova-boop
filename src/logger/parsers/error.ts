import { types } from 'util'
import { Parser } from './parser'

export type IAxiosError = {
  isAxiosError: true
  code?: unknown
  message?: unknown
  stack?: unknown
  response?: {
    status?: unknown
    statusText?: unknown
    data?: unknown
  }
  config?: {
    baseURL?: unknown
    url?: unknown
    method?: unknown
    data?: unknown
  }
}

interface IErrorMeta {
  type?: unknown
  message: unknown
  stack?: unknown
  data?: { message: unknown; code?: unknown; body?: unknown }
  config?: { url?: unknown; method?: unknown }
  cause?: string
}

export class ErrorParser extends Parser<IAxiosError> {
  types = [
    { type: 'PimError', filter: 'akeneo.com' },
    { type: 'DamError', filter: 'getbynder.com' },
    { type: '360Error', filter: 'cappasity.com' },
    { type: 'VideoError', filter: 'brightcove.com' },
    { type: 'IodsError', filter: '/iods/v2' },
    { type: 'AWSError', filter: 'aws-sdk' },
    { type: 'KafkaError', filter: 'kafkajs' },
  ]

  parse(error?: unknown): IErrorMeta | undefined {
    if (error instanceof ForwardedError) {
      return this.parseForwardedError(error)
    }
    if (this.isAxiosError(error)) {
      return this.parseAxiosError(error)
    }
    if (types.isNativeError(error)) {
      return this.parseNativeError(error)
    }
    if (error) {
      return this.parseError(error)
    }
  }

  private parseForwardedError(error: ForwardedError) {
    const superError = this.parse(error.cause)
    if (superError) {
      return { cause: error.message, ...superError }
    }
    return this.parseError(error.message)
  }

  private parseAxiosError(error: IAxiosError) {
    const url = [error.config?.baseURL, error.config?.url].filter(Boolean).join('') || undefined
    return {
      type: this.getType(url) || 'AxiosError',
      message: error.message,
      data: {
        message: error.response?.statusText || error.code,
        code: error.response?.status,
        body: super.parse(error.response?.data),
      },
      config: { url, method: error.config?.method },
    }
  }

  private parseNativeError(error: Error) {
    const type = this.getType(error.stack) || error.constructor.name
    return {
      type,
      message: error.message,
      ...(type === 'TypeError' && { stack: error.stack }),
    }
  }

  private parseError(error: unknown) {
    return { type: 'UnknownError', message: super.parse(error) }
  }

  protected isAxiosError(error?: unknown): error is IAxiosError {
    return this.isObject(error) && 'isAxiosError' in error
  }

  private getType(str?: string) {
    return this.types.find(({ filter }) => str?.includes(filter))?.type
  }
}

export class ForwardedError extends Error {
  cause: unknown

  constructor(cause: string, error: unknown) {
    super(error instanceof ForwardedError ? `${cause}.${error.message}` : cause)
    this.cause = error instanceof ForwardedError ? error.cause : error
  }
}
