import { click, sleep } from '@src/helpers/utils'
import { ILogger } from '@src/logger'
import { PuppeteerManager } from '@src/modules/puppeteer'
import { redisStore } from '@src/services/redis'
import { Message } from '@src/settings'
import moment, { Moment } from 'moment'
import { Browser, ElementHandle, Page } from 'puppeteer'

const avgSongsPerHour = 15
const wrongIds = ['4LRPiXqCikLlN15c3yImP7'] //Nova website set this id to unknown id songs. WTF
const replaceIds = { '1julw87xjTSzLLqAv8aNab': '5vmRQ3zELMLUQPo2FLQ76x' } //Nova website linked wrong ids

export class NovaJob {
  puppeteerService = new PuppeteerManager(this.logger.child())

  constructor(private logger: ILogger<Message>) {}

  async run(from: Moment): Promise<string[]> {
    const { success, failure } = this.logger.action('nova_fetch_items')
    try {
      const songs = await this.scrappe(from)
      success()
      return songs
    } catch (error) {
      failure(error)
      throw error
    }
  }

  async scrappe(from: Moment): Promise<string[]> {
    const { success, failure } = this.logger.action('nova_scrapping')
    const browser: Browser = await this.puppeteerService.runBrowser()

    try {
      const page = await this.puppeteerService.createPage(browser, 'https://www.nova.fr/c-etait-quoi-ce-titre/')

      const cookies = await page.$('#didomi-notice-agree-button')
      await cookies?.click()

      const diff = this.calculateDiff(from)

      const firstDay = await this.firstDay(page, from)
      const nextDays = await this.nextDays(page, from, diff)

      const songs = this.filter([...firstDay, ...nextDays])
      await this.puppeteerService.release(browser)
      success({ nbSongs: songs.length })
      return songs
    } catch (error) {
      await this.puppeteerService.release(browser)
      failure(error)
      return []
    }
  }

  calculateDiff(from: Moment) {
    const fromDate = moment(moment.utc(from).startOf('day'))
    const nowDate = moment(moment.utc(Date.now()).startOf('day'))
    return nowDate.diff(fromDate, 'days')
  }

  async firstDay(page: Page, from: Moment): Promise<string[]> {
    const fromDate = from.format('MM/DD/YYYY')
    const toHour = from.format('HH:mm')
    const firstDay = await this.scrappeDay(page, fromDate, toHour)
    return firstDay
  }

  async nextDays(page: Page, from: Moment, diff: number): Promise<string[]> {
    const result: string[] = []
    for (let i = 1; i <= diff; i++) {
      const fromDate = from.clone().add(i, 'days').format('MM/DD/YYYY')
      if (i === diff) console.log('Here')
      const songs = await this.scrappeDay(page, fromDate)
      if (songs) result.push(...songs)
    }
    return result
  }

  async scrappeDay(page: Page, beginDate: string, toHour: string = '00:00'): Promise<string[]> {
    const { success, failure } = this.logger.action('nova_scrapping_day', { beginDate })
    try {
      const calendar = await page.$('input[name=programDate]')
      await calendar?.focus()
      await calendar?.type(beginDate)

      const selects = await page.$$('.ui-timepicker-select')

      const hourInput = selects[0]
      await hourInput?.select('23')

      const minuteInput = selects[1]
      await minuteInput?.select('59')

      const filtrer = await page.waitForXPath("//*[contains(text(), 'Filtrer')]")
      await filtrer?.evaluate(click)

      const fromHour = moment(beginDate, 'MM/DD').isSame(new Date(), 'day') ? new Date().getHours() + 1 : 24
      const times = this.calculateLoad(parseInt(toHour.slice(0, 2)), fromHour)

      await this.loadMore(page, times)
      await sleep(500)

      const songsBlock = await page.$('#js-programs-list')
      const songs = await songsBlock?.$$('.wwtt_right')

      let result: string[] = []
      if (songs) {
        for (let i = 0; i < 3; i++) {
          //for loop instead of while to avoid infinite loop
          const allSongs = await this.validateDisplay(songs, toHour)
          if (allSongs) break
          this.loadMore(page, 1)
        }
        result = await this.extract(songs, toHour)
      }
      success({ results: result.length })
      return result
    } catch (error) {
      failure(error)
      return []
    }
  }

  calculateLoad(toHour: number, fromHour: number = 24) {
    return Math.ceil(((fromHour - toHour - 1) * avgSongsPerHour) / 10) //#load_more displays 10 more songs
  }

  async loadMore(page: Page, times: number = 10) {
    const { success, failure } = this.logger.action('nova_load_more')
    try {
      const loadMore = await page.$('#load_more')
      if (await this.isDisabled(loadMore)) await this.reset(loadMore) //reset style to ensure it's clickable at first
      for (let i = 0; i <= times; i++) {
        if (await this.isDisabled(loadMore)) return
        await loadMore?.click()
        await sleep(500)
      }
      success()
    } catch (error) {
      failure(error)
    }
  }

  async isDisabled(element: ElementHandle<Element> | null): Promise<boolean> {
    const style = await element?.evaluate((a) => a.getAttribute('style'))
    return style && style === 'display: none;' ? true : false
  }

  async reset(element: ElementHandle<Element> | null): Promise<void> {
    await element?.evaluate((a) => a.setAttribute('style', 'inherit'))
  }

  async extract(elements: ElementHandle<Element>[], toHour: string): Promise<string[]> {
    const { success, failure } = this.logger.action('nova_extract')
    let songs: string[] = []
    try {
      for (const [index, element] of elements.entries()) {
        const hour = await element.$eval('.time', (el) => el.textContent)
        if (index === 0 && hour) redisStore.tempDate = hour
        if (element) if (hour && hour < toHour) break
        const platforms = await element.$$eval('a', (link) => link.map((a) => a.href))
        const spotifyId = platforms
          .map((plat) => (plat.includes('spotify') ? this.getSpotifyId(plat) : null))
          .filter(Boolean)[0]
        if (spotifyId && !wrongIds.includes(spotifyId)) songs.unshift(spotifyId)
      }
      success({ nbItems: songs.length })
      return songs
    } catch (error) {
      failure(error)
      return []
    }
  }

  async validateDisplay(elements: ElementHandle<Element>[], toHour: string): Promise<boolean> {
    try {
      const hour = await elements[elements.length - 1].$eval('.time', (el) => el.textContent)
      return hour ? hour <= toHour : false
    } catch (error) {
      throw error
    }
  }

  private getSpotifyId(url: string): string {
    const match = url.split('track/')
    let result: string = ''
    if (match && match[1]) result = match[1]
    return this.fixId(result)
  }

  private fixId(spotifyId: string): string {
    let result = spotifyId
    if (Object.keys(replaceIds).includes(spotifyId)) result = replaceIds[spotifyId]
    return result
  }

  private filter(songs: string[]): string[] {
    const set = new Set(songs.reverse())
    return [...set].reverse()
  }
}
