import { formatDate } from '@src/helpers/formatDate'
import { click, sleep } from '@src/helpers/utils'
import { ILogger } from '@src/logger'
import { PuppeteerManager } from '@src/modules/puppeteer'
import { Message } from '@src/settings'
import { getLastUpdateDate, setLastUpdateDate } from '@src/store'
import moment from 'moment'
import { Browser, ElementHandle, Page } from 'puppeteer'

const avgSongsPerHour = 15

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

      const storedDate = await getLastUpdateDate(this.logger.child())
      const from = formatDate(storedDate)
      const diff = moment().diff(from, 'days')

      const firstDay = await this.firstDay(page, from)
      const nextDays = await this.nextDays(page, from, diff)

      const songs = [...firstDay, ...nextDays]

      // if (filtrer) filtrer.click()

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

  async firstDay(page: Page, from): Promise<unknown[]> {
    const fromDate = from.format('MM/DD/YYYY')

    const calendar = await page.$('input[name=programDate]')
    await calendar?.focus()
    await calendar?.type(fromDate)

    const selects = await page.$$('.ui-timepicker-select')

    const hourDate = from.hour()
    const hour = selects[0]
    await hour?.select(hourDate.toString())

    const minuteDate = from.minute()
    const minute = selects[1]
    await minute?.select(minuteDate.toString())

    const filtrer = await page.waitForXPath("//*[contains(text(), 'Filtrer')]")
    await filtrer?.evaluate(click)

    const times = this.calculateLoad(hourDate)

    await this.loadMore(page, times)
    await sleep(500)

    const songsBlock = await page.$('#js-programs-list')
    const songs = await songsBlock?.$$('.wwtt_right')
    if (songs) return await this.extract(songs)
    else return []
  }

  async nextDays(page: Page, from, diff: number): Promise<unknown[]> {
    return []
  }

  async loadMore(page: Page, times: number = 10) {
    const { success, failure } = this.logger.action('nova_load_more')
    try {
      const loadMore = await page.$('#load_more')
      for (let i = 0; i <= times; i++) {
        await loadMore?.click()
        await sleep(500)
      }
      success()
    } catch (error) {
      failure(error)
    }
  }

  calculateLoad(hour: number) {
    return Math.ceil(((hour + 1) * avgSongsPerHour) / 10) //load more displays 10 more songs
  }

  async extract(elements: ElementHandle<Element>[]): Promise<unknown[]> {
    let songs: Array<unknown> = []
    for (let element of elements) {
      const hour = await element.$eval('.time', (el) => el.textContent)
      const platforms = await element.$$eval('a', (link) => link.map((a) => a.href))
      const spotify = platforms.map((platform) => (platform.includes('spotify') ? platform : null)).filter(Boolean)[0]
      const song = { hour, spotify }
      songs.push(song)
    }
    return songs
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
