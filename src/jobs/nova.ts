import { click, sleep } from '@src/helpers/utils'
import { ILogger } from '@src/logger'
import { INovaSong } from '@src/models'
import { PuppeteerManager } from '@src/modules/puppeteer'
import { Message } from '@src/settings'
import moment, { Moment } from 'moment'
import { Browser, ElementHandle, Page } from 'puppeteer'

const avgSongsPerHour = 15
const wrongIds = ['4LRPiXqCikLlN15c3yImP7'] //Nova website has wrong linked ids. WTF

export class NovaJob {
  puppeteerService = new PuppeteerManager(this.logger.child())

  constructor(private logger: ILogger<Message>) { }

  async run(from: Moment): Promise<INovaSong[]> {
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

  async scrappe(from: Moment): Promise<INovaSong[]> {
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

  async firstDay(page: Page, from: Moment): Promise<INovaSong[]> {
    const fromDate = from.format('MM/DD/YYYY')
    const firstDay = await this.scrappeDay(page, fromDate, from.hour().toString(), from.minute().toString())
    return firstDay
  }

  async nextDays(page: Page, from: Moment, diff: number): Promise<INovaSong[]> {
    const result: INovaSong[] = []
    for (let i = 1; i <= diff; i++) {
      const fromDate = from.clone().add(i, 'days').format('MM/DD/YYYY')
      const songs = await this.scrappeDay(page, fromDate)
      if (songs) result.push(...songs)
    }
    return result
  }

  async scrappeDay(page: Page, beginDate: string, hour: string = '23', minute: string = '59'): Promise<INovaSong[]> {
    const { success, failure } = this.logger.action('nova_scrapping_day', { beginDate })
    try {
      const calendar = await page.$('input[name=programDate]')
      await calendar?.focus()
      await calendar?.type(beginDate)

      const selects = await page.$$('.ui-timepicker-select')

      const hourInput = selects[0]
      await hourInput?.select(hour)

      const minuteInput = selects[1]
      await minuteInput?.select(minute)

      const filtrer = await page.waitForXPath("//*[contains(text(), 'Filtrer')]")
      await filtrer?.evaluate(click)

      const times = this.calculateLoad(parseInt(hour))

      await this.loadMore(page, times)
      await sleep(500)

      const songsBlock = await page.$('#js-programs-list')
      const songs = await songsBlock?.$$('.wwtt_right')
      const result = songs ? await this.extract(songs) : []
      success({ results: result.length })
      return result
    } catch (error) {
      failure(error)
      return []
    }
  }

  calculateLoad(hour: number) {
    return Math.ceil(((hour + 1) * avgSongsPerHour) / 10) //#load_more displays 10 more songs
  }

  async loadMore(page: Page, times: number = 10) {
    const { success, failure } = this.logger.action('nova_load_more')
    try {
      const loadMore = await page.$('#load_more')
      if (await this.isDisabled(loadMore)) await this.reset(loadMore) //reset style to ensure it's clickable at first
      //+10 to ensure reaching limit for now, we'll see if some recursive validation is needed/better
      for (let i = 0; i <= times + 10; i++) {
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

  async extract(elements: ElementHandle<Element>[]): Promise<INovaSong[]> {
    const { success, failure } = this.logger.action('nova_extract')
    let songs: INovaSong[] = []
    try {
      for (let element of elements) {
        const hour = await element.$eval('.time', (el) => el.textContent)
        const platforms = await element.$$eval('a', (link) => link.map((a) => a.href))
        const spotifyId = platforms
          .map((plat) => (plat.includes('spotify') ? this.getSpotifyId(plat) : null))
          .filter(Boolean)[0]
        if (hour && spotifyId && !wrongIds.includes(spotifyId)) {
          const song = { hour, spotifyId }
          songs = this.deduplicate(song, songs)
        }
      }
      success({ nbItems: songs.length })
      return songs
    } catch (error) {
      failure(error)
      return []
    }
  }

  private getSpotifyId(url: string): string {
    const match = url.split('track/')
    let result: string = ''
    if (match && match[1]) result = match[1]
    return result
  }

  private deduplicate(song: INovaSong, songs: INovaSong[]): INovaSong[] {
    const index = songs.findIndex((element) => element.spotifyId === song.spotifyId)
    if (index && index > -1) {
      songs.splice(index, 1)
    }
    songs.push(song)
    return songs
  }

  private filter(songs: INovaSong[]): INovaSong[] {
    let result: INovaSong[] = []
    for (const song of songs) {
      result = this.deduplicate(song, songs)
    }
    return result
  }
}
