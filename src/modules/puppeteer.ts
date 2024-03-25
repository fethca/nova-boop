import { ILogger, Logger } from '@fethcat/logger'
import { Browser, DEFAULT_INTERCEPT_RESOLUTION_PRIORITY, Page } from 'puppeteer'
import puppeteer from 'puppeteer-extra'
import blockResourcesPlugin from 'puppeteer-extra-plugin-block-resources'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { getRandom } from 'random-useragent'
import { Message, settings } from '../settings.js'
import { IPuppeteerManager } from '../types.js'

const { instanceId, logs, metadata } = settings

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.75 Safari/537.36'

puppeteer.default
  .use(
    blockResourcesPlugin({
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
    }),
  )
  .use(StealthPlugin())

export class PuppeteerManager implements IPuppeteerManager {
  logger: ILogger<Message> = Logger.create<Message>(instanceId, logs, metadata)
  isReleased = false
  retries = 0

  async init() {
    this.isReleased = false
    this.retries = 0
    const browser = await this.runBrowser()

    browser?.on('disconnected', async () => {
      if (this.isReleased) return
      this.logger.error('puppeteer_browser_disconnected')
      if (this.retries <= 3) {
        this.retries++
        if (browser) browser.process()?.kill('SIGINT')
        await this.runBrowser()
      } else {
        throw 'Browser crashed more than 3 times'
      }
    })
  }

  async runBrowser(): Promise<Browser> {
    const { success, failure } = this.logger.action('puppeteer_run_browser')
    try {
      const browser = await puppeteer.default.launch({
        headless: false,
        devtools: false,
        ignoreHTTPSErrors: true,
        slowMo: 0,
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

      success()
      return browser
    } catch (error) {
      throw failure(error)
    }
  }

  async createPage(browser: Browser, url: string): Promise<Page> {
    const { success, failure } = this.logger.action('puppeteer_create_page')
    try {
      if (!browser) await this.init()
      const userAgent = getRandom((ua) => ua.engineName === 'Gecko') || USER_AGENT
      const page = await browser.newPage()
      await page.setViewport({
        width: 1920 + Math.floor(Math.random() * 100),
        height: 3000 + Math.floor(Math.random() * 100),
        deviceScaleFactor: 1,
        hasTouch: false,
        isLandscape: false,
        isMobile: false,
      })

      await page.setUserAgent(userAgent)
      await page.setJavaScriptEnabled(true)
      page.setDefaultNavigationTimeout(0)

      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false })
      })

      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] })
      })

      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] })
      })

      await page.goto(url, { waitUntil: 'networkidle2', timeout: 0 })
      success()
      return page
    } catch (error) {
      throw failure(error)
    }
  }

  public async release(browser: Browser) {
    const { success, failure } = this.logger.action('puppeteer_stop_browser')
    try {
      this.isReleased = true
      await browser.close()
      success()
    } catch (error) {
      failure(error)
    }
  }
}
