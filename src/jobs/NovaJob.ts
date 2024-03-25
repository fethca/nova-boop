import { ILogger, Logger } from '@fethcat/logger'
import isEqual from 'lodash.isequal'
import uniqWith from 'lodash.uniqwith'
import moment, { Moment, utc } from 'moment'
import { Browser, ElementHandle, Page } from 'puppeteer'
import { setTempDate } from '../helpers/redis.js'
import { click, findText, wait } from '../helpers/utils.js'
import { PuppeteerManager } from '../modules/puppeteer.js'
import { Message, settings } from '../settings.js'
import { ITrack } from '../types.js'

const { instanceId, logs, metadata } = settings

const avgTracksPerHour = 15
const wrongIds = ['4LRPiXqCikLlN15c3yImP7', '2N6CSu4nnTgEGlXXR9L1a1'] //Nova website set this id to unknown id tracks
const replaceIds: Record<string, string> = {
  '1julw87xjTSzLLqAv8aNab': '5vmRQ3zELMLUQPo2FLQ76x',
  '7IVcBBERvJG0bgZ4UZEB7R': '6kopmMZiyLmw7h66uXcXR7',
} //Nova website linked wrong ids

export class NovaJob {
  protected logger: ILogger<Message> = Logger.create<Message>(instanceId, logs, metadata)
  private puppeteer = new PuppeteerManager()

  async run(from: Moment): Promise<ITrack[]> {
    const { success, failure } = this.logger.action('nova_fetch_items')
    try {
      const tracks = await this.scrappe(from)
      success()
      return tracks
    } catch (error) {
      failure(error)
      return []
    }
  }

  private async scrappe(from: Moment): Promise<ITrack[]> {
    const { success, failure } = this.logger.action('nova_scrapping')

    const browser: Browser = await this.puppeteer.runBrowser()

    try {
      const page = await this.puppeteer.createPage(browser, 'https://nova.fr/c-etait-quoi-ce-titre')

      const cookies = await page.$('#didomi-notice-agree-button')
      await cookies?.click()

      const scrappe = await this.scrappeDays(page, from)
      const tracks = uniqWith(scrappe, isEqual)
      await this.puppeteer.release(browser)
      success({ nbTracks: tracks.length })
      return tracks
    } catch (error) {
      await this.puppeteer.release(browser)
      throw failure(error)
    }
  }

  private async scrappeDays(page: Page, from: Moment): Promise<ITrack[]> {
    const diff = this.calculateDiff(from)
    const result: ITrack[] = []
    for (let i = 0; i <= diff; i++) {
      const hour = i === 0 ? from.format('HH:mm') : '00:00'
      const fromDate = from.clone().add(i, 'days').format('MM/DD/YYYY')
      const tracks = await this.scrappeDay(page, fromDate, hour)
      if (tracks.length) result.unshift(...tracks)
      else break
    }
    return result
  }

  private calculateDiff(from: Moment) {
    const fromDate = moment(utc(from).startOf('day'))
    const nowDate = moment(utc(Date.now()).startOf('day'))
    return nowDate.diff(fromDate, 'days')
  }

  private async scrappeDay(page: Page, beginDate: string, toHour: string = '00:00'): Promise<ITrack[]> {
    const { success, failure, skip } = this.logger.action('nova_scrapping_day', { beginDate, toHour })
    try {
      const calendar = await page.$('input[name=programDate]')
      await calendar?.focus()
      await calendar?.type(beginDate)

      const selects = await page.$$('.ui-timepicker-select')

      const hourInput = selects[0]
      await hourInput?.select('23')

      const minuteInput = selects[1]
      await minuteInput?.select('59')

      await page.select('select[name="radio"]', '910')

      const filtrer = await page.waitForSelector(findText('Filtrer'))
      await filtrer?.evaluate(click)

      const fromHour = moment(beginDate, 'MM/DD').isSame(new Date(), 'day') ? new Date().getHours() + 1 : 24
      const times = this.calculateLoad(parseInt(toHour.slice(0, 2)), fromHour)

      await this.loadMore(page, times)
      await wait(1000)

      const tracksBlock = await page.$('#js-programs-list')
      const tracks = await tracksBlock?.$$('.wwtt_right')
      if (!tracks?.length) {
        const novaDown = await page.waitForSelector(findText('Service momentanément indisponible.'))
        if (novaDown) skip(`nova_website_down_for_this_day`)
        else skip('no_tracks_for_this_day')
        return []
      }

      let result: ITrack[] = []
      for (let i = 0; i < 3; i++) {
        const allTracks = await this.validateDisplay(tracks, toHour)
        if (allTracks) break
        await this.loadMore(page, 1)
      }
      result = await this.extract(tracks, beginDate, toHour)

      success({ results: result.length })
      return result
    } catch (error) {
      throw failure(error)
    }
  }

  private calculateLoad(toHour: number, fromHour: number = 24) {
    return Math.ceil(((fromHour - toHour - 1) * avgTracksPerHour) / 10) //#load_more displays 10 more tracks
  }

  private async loadMore(page: Page, times: number = 10) {
    const { success, failure } = this.logger.action('nova_load_more')
    try {
      const loadMore = await page.$('#load_more')
      if (await this.isDisabled(loadMore)) await this.reset(loadMore) //reset style to ensure it's clickable at first
      for (let i = 0; i <= times; i++) {
        if (await this.isDisabled(loadMore)) return
        await loadMore?.click()
        //going too fast and not scrolling mess up with website capacities.
        await wait(2000) //optimized time can vary, less than 1000 is too risky
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
        await wait(2000)
      }
      success()
    } catch (error) {
      failure(error)
    }
  }

  private async isDisabled(element: ElementHandle<Element> | null): Promise<boolean> {
    const style = await element?.evaluate((a) => a.getAttribute('style'))
    return style && style === 'display: none;' ? true : false
  }

  private async reset(element: ElementHandle<Element> | null): Promise<void> {
    await element?.evaluate((a) => a.setAttribute('style', 'inherit'))
  }

  private async validateDisplay(elements: ElementHandle<Element>[], toHour: string): Promise<boolean> {
    const hour = await elements[elements.length - 1].$eval('.time', (el) => el.textContent)
    return hour ? hour <= toHour : false
  }

  private async extract(elements: ElementHandle<Element>[], date: string, toHour: string): Promise<ITrack[]> {
    const { success, failure } = this.logger.action('nova_extract')
    const tracks: ITrack[] = []
    try {
      for (const [index, element] of elements.entries()) {
        const artist = (await element.$eval('h2', (el) => el.textContent)) || ''
        const title = (await element.$eval('p:nth-of-type(2)', (el) => el.textContent)) || ''
        const hour = await element.$eval('.time', (el) => el.textContent)
        if (index === 0 && hour) setTempDate(date, hour)
        if (element) if (hour && hour < toHour) break
        const platformsElement = await element.$$eval('a', (link) => link.map((a) => a.href))
        let platforms: { spotify?: string; deezer?: string } = {}
        for (const element of platformsElement) {
          const platform = this.getPlatformId(element)
          if (platform) platforms = { ...platform, ...platforms }
        }
        const track = { artist, title, spotifyId: platforms.spotify, deezerId: platforms.deezer }
        tracks.push(track)
      }
      success({ nbItems: tracks.length })
      return tracks
    } catch (error) {
      throw failure(error)
    }
  }

  private getPlatformId(url: string): { spotify: string } | { deezer: string } | undefined {
    if (url.includes('spotify')) return { spotify: this.getTrackId(url) }
    if (url.includes('deezer')) return { deezer: this.getTrackId(url) }
    return
  }

  private getTrackId(url: string): string {
    const match = url.split('track/')
    let result: string = ''
    if (match && match[1]) result = match[1]
    return this.fixId(result)
  }

  private fixId(spotifyId: string): string {
    let result = spotifyId
    if (Object.keys(replaceIds).includes(spotifyId)) result = replaceIds[spotifyId]
    if (wrongIds.includes(result)) result = ''
    return result
  }
}
