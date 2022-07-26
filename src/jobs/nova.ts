import { ILogger } from '@src/logger'
import { Message } from '@src/settings'
import * as puppeteer from 'puppeteer'

export class NovaJob {
  constructor(private logger: ILogger<Message>) {}

  async fetchItems(fromDate: string, toDate: string) {
    const { success, failure } = this.logger.action('nova_fetch_items')
    try {
      await this.scrappe(fromDate, toDate)
    } catch (error) {}
  }

  async scrappe(fromDate: string, toDate: string) {
    const { success, failure } = this.logger.action('nova_scrapping')

    const browser = await puppeteer.launch({ headless: false })
    try {
      const page = await browser.newPage()
      await page.goto('https://www.nova.fr/c-etait-quoi-ce-titre/')
      const cookies = await page.$('#didomi-notice-agree-button')
      await cookies?.click()
      success()
    } catch (error) {
      await browser.close()
      failure(error)
    }
  }
}
