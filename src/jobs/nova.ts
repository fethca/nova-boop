import { ILogger } from '@src/logger'
import { Message } from '@src/settings'

export class NovaJob {
  constructor(private logger: ILogger<Message>) {}

  private async fetchItems(fromDate: string, toDate: string) {
    const { success, failure } = this.logger.action('nova_fetch_items')
    try {
    } catch (error) {}
  }
}
