import { Browser, Page } from 'puppeteer'

export interface Response<T> {
  body: T
  headers: Record<string, string>
  statusCode: number
}

export type ITrack = {
  artist: string
  title: string
  spotifyId?: string
  deezerId?: string
}

export interface IPuppeteerManager {
  init(): Promise<void>
  runBrowser(): Promise<Browser>
  createPage(browser: Browser, url: string): Promise<Page>
  release(browser: Browser): Promise<void>
}
