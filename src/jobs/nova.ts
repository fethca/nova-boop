import { formatDate } from '@src/helpers/formatDate'
import { ILogger } from '@src/logger'
import { PuppeteerManager } from '@src/modules/puppeteer'
import { Message } from '@src/settings'
import { getLastUpdateDate, setLastUpdateDate } from '@src/store'
import { Browser, Page } from 'puppeteer'
export class NovaJob {
  puppeteerService = new PuppeteerManager(this.logger.child())

  constructor(private logger: ILogger<Message>) {}

  async fetchItems(fromDate: string, toDate: string) {
    const { success, failure } = this.logger.action('nova_fetch_items')
    try {
      await this.scrappe(fromDate, toDate)
      success()
    } catch (error) {
      failure(error)
    }
  }

  async scrappe(fromDate: string, toDate: string) {
    const { success, failure } = this.logger.action('nova_scrapping')
    const browser: Browser = await this.puppeteerService.runBrowser()

    try {
      const page = await this.puppeteerService.createPage(browser, 'https://www.nova.fr/c-etait-quoi-ce-titre/')

      const cookies = await page.$('#didomi-notice-agree-button')
      await cookies?.click()

      const from = await getLastUpdateDate(this.logger.child())
      const fromDate = formatDate(from)
      const day = fromDate.day()
      const month = fromDate.month()
      const year = fromDate.year()
      const hour = fromDate.hour()
      const minute = fromDate.minute()
      // let count = 0
      // while (count < 50) {
      //   await this.loadMore(page)
      //   count++
      //   console.log('count', count)
      // }
      success()
    } catch (error) {
      await this.puppeteerService.release(browser)
      failure(error)
    }
  }

  async loadMore(page: Page) {
    const { success, failure } = this.logger.action('nova_load_more')
    try {
      const loadMore = await page.$('#load_more')
      await loadMore?.click()
      success()
    } catch (error) {
      failure(error)
    }
  }

  async updateDate(date: number): Promise<void> {
    const newDate = formatDate(date)
    const { success, failure } = this.logger.action('redis_update_date', { newDate })
    try {
      await setLastUpdateDate(date)
      success()
    } catch (error) {
      failure(error)
    }
  }
}
