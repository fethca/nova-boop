import { Parser } from './parser'

export class AppParser extends Parser {
  parse(payload?: unknown): unknown {
    if (this.isObject(payload)) {
      return {
        name: String(payload.name),
        version: String(payload.version),
        env: String(payload.env),
      }
    }
  }
}
