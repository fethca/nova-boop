import { MockedLogger } from '@fethcat/logger'
import { Browser, ElementHandle, Page } from 'puppeteer'
import { IPuppeteerManager, ITrack } from '../src/types.js'

export const mockTrack = (track?: Partial<ITrack>) => ({
  artist: 'artist',
  title: 'title',
  spotifyId: 'spotifyId',
  deezerId: 'deezerId',
  ...track,
})

export class MockedPuppeteer implements IPuppeteerManager {
  isReleased = false
  retries = 0
  logger = new MockedLogger()
  init = vi.fn()
  release = vi.fn()
  runBrowser = vi.fn().mockResolvedValue(mockBrowser())
  createPage = vi.fn().mockResolvedValue({
    $: vi.fn().mockResolvedValue({ click: vi.fn() }),
  })
}

export function mockBrowser(): Browser {
  return {} as unknown as Browser
}

type IPage = { page: Page; element: ElementHandle<Element>; elements: ElementHandle<Element>[] }

export function mockPage(puppeteer: IPuppeteerManager, tracks?: ITrack[]): IPage {
  const element = mockElement(tracks)
  const elements = Array(2).fill(mockElement(tracks))
  const page = {
    $: vi.fn().mockResolvedValue(element),
    $$: vi.fn().mockResolvedValue(elements),
    select: vi.fn(),
    waitForSelector: vi.fn().mockResolvedValue(element),
    evaluate: vi.fn(),
  } as unknown as Page
  puppeteer.createPage = vi.fn().mockResolvedValue(page)
  return { page, element, elements }
}

export function mockElement(tracks?: ITrack[]): ElementHandle<Element> {
  const element = {
    click: vi.fn(),
    select: vi.fn(),
    focus: vi.fn(),
    type: vi.fn(),
    evaluate: vi.fn(),
    $eval: vi.fn(),
    $$eval: vi.fn().mockResolvedValue([]),
    $$: vi.fn().mockResolvedValue(tracks || []),
  } as unknown as ElementHandle
  return element
}
