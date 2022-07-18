import { inspect } from 'util'

export class Parser<T = Record<string, unknown>> {
  parse(info?: unknown): unknown {
    if (!this.isObject(info)) return info
    try {
      return JSON.stringify(info)
    } catch (error) {
      return inspect(info)
    }
  }

  protected isObject(param?: unknown): param is T {
    return typeof param === 'object' && param !== null
  }
}
