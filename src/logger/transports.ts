import { join } from 'path'
import winston from 'winston'
import { ConsoleTransportInstance, FileTransportInstance } from 'winston/lib/winston/transports'
import { LoggerOptions } from './types'

const { Console, File } = winston.transports

export function consoleTransport(options: LoggerOptions): ConsoleTransportInstance {
  return new Console({
    format: winston.format.combine(
      winston.format.timestamp(),
      options.colorize ? winston.format.colorize() : winston.format((info) => info)(),
      winston.format[options.format || 'json']()
    ),
  })
}

export function fileTransport(options: LoggerOptions): FileTransportInstance {
  return new File({
    maxFiles: 4,
    maxsize: 20971520, // 20MB
    filename: join('logs', `${options.file}.log`),
    format: winston.format.combine(winston.format.timestamp(), winston.format[options.format || 'json']()),
  })
}
