import { ILogger } from '@src/logger'
import { Message } from '@src/settings'
import { Browser, DEFAULT_INTERCEPT_RESOLUTION_PRIORITY, Page } from 'puppeteer'
import puppeteer from 'puppeteer-extra'
import BlockResourcesPlugin from 'puppeteer-extra-plugin-block-resources'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import randomUseragent from 'random-useragent'

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.75 Safari/537.36'

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

export class PuppeteerManager {
  private isReleased = false
  private retries = 0

  constructor(private logger: ILogger<Message>) {}

  private async init() {
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

  public async runBrowser(): Promise<Browser> {
    const { success, failure } = this.logger.action('puppeteer_run_browser')
    try {
      const browser = await puppeteer.launch({
        headless: true,
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

  public async createPage(browser: Browser, url: string): Promise<Page> {
    const { success, failure } = this.logger.action('puppeteer_create_page')
    try {
      if (!browser) await this.init()
      const userAgent = randomUseragent.getRandom((ua) => ua.engineName === 'Gecko') || USER_AGENT
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
      await page.setDefaultNavigationTimeout(0)

      await page.evaluateOnNewDocument(() => {
        //pass webdriver check
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        })
      })

      await page.evaluateOnNewDocument(() => {
        // Overwrite the `plugins` property to use a custom getter.
        Object.defineProperty(navigator, 'plugins', {
          // This just needs to have `length > 0` for the current test,
          // but we could mock the plugins too if necessary.
          get: () => [1, 2, 3, 4, 5],
        })
      })

      await page.evaluateOnNewDocument(() => {
        // Overwrite the `plugins` property to use a custom getter.
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        })
      })

      await page.goto(url, { waitUntil: 'networkidle2', timeout: 0 })
      success()
      return page
    } catch (error) {
      throw failure(error)
    }
  }
}
