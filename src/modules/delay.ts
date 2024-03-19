import { EventEmitter } from 'node:stream'

export interface IDelayQueue<T> {
  processMessages(referenceDate: number): Promise<void>
}

export interface IDelayQueueOptions<T> {
  delay: number
  processMessage: (item: T) => Promise<void> | void
}

export class DelayQueue<T> extends EventEmitter implements IDelayQueue<T> {
  private busy = false
  private queue: { item: T; timestamp: number }[] = []

  private delay: number
  private processMessage: IDelayQueueOptions<T>['processMessage']

  constructor(options: IDelayQueueOptions<T>) {
    super()
    this.delay = options.delay
    this.processMessage = options.processMessage
    setInterval(this.runInterval.bind(this), this.delay * 1000)
  }

  private runInterval() {
    if (this.queue.length && !this.busy) {
      this.processMessages(Date.now() - this.delay * 1000)
    }
  }

  async processMessages(referenceDate: number): Promise<void> {
    this.busy = true
    await this.recurse(referenceDate)
    this.busy = false
  }

  private async recurse(referenceDate: number): Promise<void> {
    const message = this.queue[0]
    if (message?.timestamp < referenceDate) {
      this.emit('process-message', this.delay, message.item)
      await this.processMessage(message.item)
      this.queue.shift()
      await this.recurse(referenceDate)
    }
  }

  enqueue(item: T): void {
    this.queue.push({ item, timestamp: Date.now() })
  }
}
