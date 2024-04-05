import { Page } from 'puppeteer'

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
  createPage(url: string): Promise<Page>
  destroy(): Promise<void>
}

export type ISpotifyError = {
  code: number
  message: string
}
