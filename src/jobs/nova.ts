import { formatDate } from '@src/helpers/formatDate'
import { ILogger } from '@src/logger'
import { Message } from '@src/settings'
import { getLastUpdateDate, setLastUpdateDate } from '@src/store'
import { DEFAULT_INTERCEPT_RESOLUTION_PRIORITY, Page } from 'puppeteer'
import puppeteer from 'puppeteer-extra'
import BlockResourcesPlugin from 'puppeteer-extra-plugin-block-resources'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

puppeteer
  .use(
    BlockResourcesPlugin({
      blockedTypes: new Set([
        'stylesheet',
        'image',
        'media',
        'font',
        'texttrack',
        'fetch',
        'eventsource',
        'websocket',
        'manifest',
      ]),
      interceptResolutionPriority: DEFAULT_INTERCEPT_RESOLUTION_PRIORITY,
    })
  )
  .use(StealthPlugin())

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.75 Safari/537.36'

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

    const browser = await puppeteer.launch({
      headless: false,
      devtools: false,
      ignoreHTTPSErrors: true,
      slowMo: 0,
      defaultViewport: null,
      args: [
        '--disable-gpu',
        '--no-sandbox',
        '--no-zygote',
        '--disable-setuid-sandbox',
        '--disable-accelerated-2d-canvas',
        '--disable-dev-shm-usage',
        "--proxy-server='direct://'",
        '--proxy-bypass-list=*',
      ],
    })

    try {
      const page = await browser.newPage()
      await page.goto('https://www.nova.fr/c-etait-quoi-ce-titre/')

      const cookies = await page.$('#didomi-notice-agree-button')
      await cookies?.click()

      const from = await getLastUpdateDate(this.logger.child())
      const fromDate = formatDate(from)

      // let count = 0
      // while (count < 50) {
      //   await this.loadMore(page)
      //   count++
      //   console.log('count', count)
      // }
      success()
    } catch (error) {
      await browser.close()
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
