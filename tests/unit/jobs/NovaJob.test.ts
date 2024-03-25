import { MockedLogger, mockAction } from '@fethcat/logger'
import mockdate from 'mockdate'
import moment from 'moment'
import { Page } from 'puppeteer'
import { setTempDate } from '../../../src/helpers/redis.js'
import * as utils from '../../../src/helpers/utils.js'
import { click, findText } from '../../../src/helpers/utils.js'
import { NovaJob } from '../../../src/jobs/NovaJob.js'
import { MockedPuppeteer, mockBrowser, mockElement, mockPage, mockTrack } from '../../mock.js'

vi.mock('../../../src/modules/puppeteer')
vi.mock('../../../src/helpers/redis')
const fromDate = moment(1710239648000) //Tuesday, March 12, 2024 10:34:08 AM
mockdate.set(1711103648000) // Friday, March 22, 2024 10:34:08 AM

describe('run', () => {
  function createJob() {
    const job = new NovaJob()
    job['logger'] = new MockedLogger()
    job['scrappe'] = vi.fn().mockResolvedValue([mockTrack()])
    return job
  }

  it('should scrappe from given date', async () => {
    const job = createJob()
    await job.run(fromDate)
    expect(job['scrappe']).toHaveBeenCalledWith(fromDate)
  })

  it('should log success', async () => {
    const job = createJob()
    const { success } = mockAction(job['logger'])
    await job.run(fromDate)
    expect(success).toHaveBeenCalledWith()
  })

  it('should return scrapped tracks', async () => {
    const job = createJob()
    const result = await job.run(fromDate)
    expect(result).toEqual([mockTrack()])
  })

  it('should log failure and return empty array', async () => {
    const job = createJob()
    const { failure } = mockAction(job['logger'])
    job['scrappe'] = vi.fn().mockRejectedValue(new Error('500'))
    const result = await job.run(fromDate)
    expect(failure).toHaveBeenCalledWith(new Error('500'))
    expect(result).toEqual([])
  })
})

describe('scrappe', () => {
  function createJob() {
    const job = new NovaJob()
    job['logger'] = new MockedLogger()
    job['puppeteer'] = new MockedPuppeteer()
    job['scrappeDays'] = vi.fn().mockResolvedValue([mockTrack()])
    return job
  }

  it('should create a new browser', async () => {
    const job = createJob()
    await job['scrappe'](fromDate)
    expect(job['puppeteer'].runBrowser).toHaveBeenCalledWith()
  })

  it('should open nova page', async () => {
    const job = createJob()
    await job['scrappe'](fromDate)
    expect(job['puppeteer'].createPage).toHaveBeenCalledWith(mockBrowser(), 'https://nova.fr/c-etait-quoi-ce-titre')
  })

  it('should accept cookies', async () => {
    const job = createJob()
    const { page, element: cookies } = mockPage(job['puppeteer'])
    await job['scrappe'](fromDate)
    expect(page.$).toHaveBeenCalledWith('#didomi-notice-agree-button')
    expect(cookies.click).toHaveBeenCalledWith()
  })

  it('should scrappe page from given date', async () => {
    const job = createJob()
    const { page } = mockPage(job['puppeteer'])
    await job['scrappe'](fromDate)
    expect(job['scrappeDays']).toHaveBeenCalledWith(page, fromDate)
  })

  it('should close browser', async () => {
    const job = createJob()
    await job['scrappe'](fromDate)
    expect(job['puppeteer'].release).toHaveBeenCalledWith(mockBrowser())
  })

  it('should log success', async () => {
    const job = createJob()
    const { success } = mockAction(job['logger'])
    await job['scrappe'](fromDate)
    expect(success).toHaveBeenCalledWith({ nbTracks: 1 })
  })

  it('should return filtered tracks', async () => {
    const job = createJob()
    job['scrappeDays'] = vi.fn().mockResolvedValue([mockTrack(), mockTrack()])
    const result = await job['scrappe'](fromDate)
    expect(result).toEqual([mockTrack()])
  })

  it('should log failure, close browser and throw', async () => {
    const job = createJob()
    const { failure } = mockAction(job['logger'])
    job['scrappeDays'] = vi.fn().mockRejectedValue(new Error('500'))
    await expect(job['scrappe'](fromDate)).rejects.toThrow(new Error('500'))
    expect(job['puppeteer'].release).toHaveBeenCalledWith(mockBrowser())
    expect(failure).toHaveBeenCalledWith(new Error('500'))
  })
})

describe('scrappeDays', () => {
  const mockPage = () => ({}) as unknown as Page

  function createJob() {
    const job = new NovaJob()
    job['logger'] = new MockedLogger()
    job['scrappeDay'] = vi.fn().mockResolvedValue([mockTrack()])
    return job
  }

  it('should scrappe each days between a given date and today', async () => {
    const job = createJob()
    await job['scrappeDays'](mockPage(), fromDate)
    expect(job['scrappeDay']).toHaveBeenCalledTimes(11)
  })

  it('should scrappe the day of the given date precisely to the french hour', async () => {
    const job = createJob()
    await job['scrappeDays'](mockPage(), fromDate)
    expect(job['scrappeDay']).toHaveBeenCalledWith(mockPage(), '03/12/2024', '11:34')
  })

  it('should stop at the last successfully scrapped day', async () => {
    const job = createJob()
    job['scrappeDay'] = vi.fn().mockResolvedValueOnce([mockTrack()]).mockResolvedValue([])
    const result = await job['scrappeDays'](mockPage(), fromDate)
    expect(job['scrappeDay']).toHaveBeenCalledTimes(2)
    expect(result).toEqual([mockTrack()])
  })

  it('should return tracks ordered from earliest to oldest', async () => {
    const job = createJob()
    job['scrappeDay'] = vi
      .fn()
      .mockResolvedValueOnce([mockTrack({ title: 'oldest' })])
      .mockResolvedValueOnce([mockTrack({ title: 'before oldest' })])
      .mockResolvedValue([mockTrack()])
    const result = await job['scrappeDays'](mockPage(), fromDate)
    expect(result).toEqual([
      ...Array(9).fill(mockTrack()),
      mockTrack({ title: 'before oldest' }),
      mockTrack({ title: 'oldest' }),
    ])
  })
})

describe('scrappeDay', () => {
  function createJob() {
    const job = new NovaJob()
    job['logger'] = new MockedLogger()
    job['loadMore'] = vi.fn()
    job['validateDisplay'] = vi.fn()
    job['extract'] = vi.fn().mockResolvedValue([mockTrack()])
    return job
  }

  beforeEach(() => {
    vi.spyOn(utils, 'wait').mockImplementation(() => Promise.resolve())
  })

  it('should focus calendar and type begin date inside', async () => {
    const job = createJob()
    const { page, element: calendar } = mockPage(job['puppeteer'])
    await job['scrappeDay'](page, '03/21/2024', '12:12')
    expect(page.$).toHaveBeenCalledWith('input[name=programDate]')
    expect(calendar.focus).toHaveBeenCalledWith()
    expect(calendar.type).toHaveBeenCalledWith('03/21/2024')
  })

  it('should set timepicker to get the whole day (23:59)', async () => {
    const job = createJob()
    const { page, elements: selects } = mockPage(job['puppeteer'])
    await job['scrappeDay'](page, '03/21/2024', '12:12')
    expect(page.$$).toHaveBeenCalledWith('.ui-timepicker-select')
    expect(selects[0].select).toHaveBeenCalledWith('23')
    expect(selects[1].select).toHaveBeenCalledWith('59')
  })

  it('should select radio nova in list', async () => {
    const job = createJob()
    const { page } = mockPage(job['puppeteer'])
    await job['scrappeDay'](page, '03/21/2024', '12:12')
    expect(page.select).toHaveBeenCalledWith('select[name="radio"]', '910')
  })

  it('should click on search button', async () => {
    const job = createJob()
    const { page, element: filtrer } = mockPage(job['puppeteer'])
    await job['scrappeDay'](page, '03/21/2024', '12:12')
    expect(page.waitForSelector).toHaveBeenCalledWith("::-p-xpath(//*[contains(text(), 'Filtrer')])")
    expect(filtrer.evaluate).toHaveBeenCalledWith(click)
  })

  it('should load more tracks to display the whole day', async () => {
    const job = createJob()
    const { page } = mockPage(job['puppeteer'])
    await job['scrappeDay'](page, '03/21/2024', '12:12')
    expect(job['loadMore']).toHaveBeenCalledWith(page, 17)
  })

  it('should get every tracks of the day', async () => {
    const job = createJob()
    const { page, element: tracksBlock } = mockPage(job['puppeteer'])
    await job['scrappeDay'](page, '03/21/2024', '12:12')
    expect(page.$).toHaveBeenCalledWith('#js-programs-list')
    expect(tracksBlock.$$).toHaveBeenCalledWith('.wwtt_right')
  })

  it('should skip and return empty array if nova is down', async () => {
    const job = createJob()
    const { skip } = mockAction(job['logger'])
    const { page } = mockPage(job['puppeteer'])
    const result = await job['scrappeDay'](page, '03/21/2024', '12:12')
    expect(page.waitForSelector).toHaveBeenCalledWith(findText('Service momentanément indisponible.'))
    expect(skip).toHaveBeenCalledWith('nova_website_down_for_this_day')
    expect(result).toEqual([])
  })

  it('should skip and return empty array if no tracks found', async () => {
    const job = createJob()
    const { skip } = mockAction(job['logger'])
    const { page } = mockPage(job['puppeteer'])
    page.waitForSelector = vi.fn().mockResolvedValue(null)
    const result = await job['scrappeDay'](page, '03/21/2024', '12:12')
    expect(page.waitForSelector).toHaveBeenCalledWith(findText('Service momentanément indisponible.'))
    expect(skip).toHaveBeenCalledWith('no_tracks_for_this_day')
    expect(result).toEqual([])
  })

  it('should check if the whole day is displayed based on given hour', async () => {
    const job = createJob()
    const { page } = mockPage(job['puppeteer'], [mockTrack()])
    await job['scrappeDay'](page, '03/21/2024', '12:12')
    expect(job['validateDisplay']).toHaveBeenCalledWith([mockTrack()], '12:12')
  })

  it('should load more if the whole day is not displayed', async () => {
    const job = createJob()
    const { page } = mockPage(job['puppeteer'], [mockTrack()])
    job['validateDisplay'] = vi.fn().mockResolvedValue(false)
    await job['scrappeDay'](page, '03/21/2024', '12:12')
    expect(job['loadMore']).toHaveBeenCalledWith(page, 1)
    expect(job['loadMore']).toHaveBeenCalledTimes(4)
  })

  it('should stop loading more if the whole day is displayed', async () => {
    const job = createJob()
    const { page } = mockPage(job['puppeteer'], [mockTrack()])
    job['validateDisplay'] = vi.fn().mockResolvedValue(true)
    await job['scrappeDay'](page, '03/21/2024', '12:12')
    expect(job['loadMore']).toHaveBeenCalledTimes(1)
    expect(job['loadMore']).not.toHaveBeenCalledWith(page, 1)
  })

  it('should extract tracks', async () => {
    const job = createJob()
    const { page } = mockPage(job['puppeteer'], [mockTrack()])
    await job['scrappeDay'](page, '03/21/2024', '12:12')
    expect(job['extract']).toHaveBeenCalledWith([mockTrack()], '03/21/2024', '12:12')
  })

  it('should return extracted tracks', async () => {
    const job = createJob()
    const { page } = mockPage(job['puppeteer'], [mockTrack()])
    const result = await job['scrappeDay'](page, '03/21/2024', '12:12')
    expect(result).toEqual([mockTrack()])
  })

  it('should log success', async () => {
    const job = createJob()
    const { page } = mockPage(job['puppeteer'], [mockTrack()])
    const { success } = mockAction(job['logger'])
    await job['scrappeDay'](page, '03/21/2024', '12:12')
    expect(success).toHaveBeenCalledWith({ results: 1 })
  })

  it('should log failure and throw', async () => {
    const job = createJob()
    const { page } = mockPage(job['puppeteer'], [mockTrack()])
    const { failure } = mockAction(job['logger'])
    job['extract'] = vi.fn().mockRejectedValue(new Error('500'))
    await expect(job['scrappeDay'](page, '03/21/2024', '12:12')).rejects.toThrow(new Error('500'))
    expect(failure).toHaveBeenCalledWith(new Error('500'))
  })
})

describe('loadMore', () => {
  function createJob() {
    const job = new NovaJob()
    job['logger'] = new MockedLogger()
    job['puppeteer'] = new MockedPuppeteer()
    job['isDisabled'] = vi.fn().mockResolvedValue(false)
    job['reset'] = vi.fn()
    return job
  }

  beforeEach(() => {
    vi.spyOn(utils, 'wait').mockImplementation(() => Promise.resolve())
  })

  it('should get load more button', async () => {
    const job = createJob()
    const { page } = mockPage(job['puppeteer'])
    await job['loadMore'](page)
    expect(page.$).toHaveBeenCalledWith('#load_more')
  })

  it('should check if load more button is disabled', async () => {
    const job = createJob()
    const { page, element: loadMore } = mockPage(job['puppeteer'])
    await job['loadMore'](page)
    expect(job['isDisabled']).toHaveBeenCalledWith(loadMore)
  })

  it('should reset load more button style if it is disabled', async () => {
    const job = createJob()
    job['isDisabled'] = vi.fn().mockResolvedValue(true)
    const { page, element: loadMore } = mockPage(job['puppeteer'])
    await job['loadMore'](page)
    expect(job['reset']).toHaveBeenCalledWith(loadMore)
  })

  it('should click on button if it is not disabled', async () => {
    const job = createJob()
    const { page, element: loadMore } = mockPage(job['puppeteer'])
    await job['loadMore'](page)
    expect(loadMore.click).toHaveBeenCalledWith()
    expect(loadMore.click).toHaveBeenCalledTimes(11)
  })

  it('should scroll to bottom after each click', async () => {
    const job = createJob()
    const { page } = mockPage(job['puppeteer'])
    await job['loadMore'](page)
    expect(page.evaluate).toHaveBeenCalledWith('window.scrollTo(0, document.body.scrollHeight)')
    expect(page.evaluate).toHaveBeenCalledTimes(11)
  })

  it('should log success', async () => {
    const job = createJob()
    const { page } = mockPage(job['puppeteer'])
    const { success } = mockAction(job['logger'])
    await job['loadMore'](page)
    expect(success).toHaveBeenCalledWith()
  })

  it('should log failure', async () => {
    const job = createJob()
    const { page } = mockPage(job['puppeteer'])
    const { failure } = mockAction(job['logger'])
    job['isDisabled'] = vi.fn().mockRejectedValue(new Error('500'))
    await job['loadMore'](page)
    expect(failure).toHaveBeenCalledWith(new Error('500'))
  })
})

describe('isDisabled', () => {
  function createJob() {
    const job = new NovaJob()
    return job
  }

  it('should return true if element has style display none', async () => {
    const job = createJob()
    const element = mockElement()
    element.evaluate = vi.fn().mockResolvedValue('display: none;')
    const result = await job['isDisabled'](element)
    expect(result).toBe(true)
  })

  it('should return false if element has not style display none', async () => {
    const job = createJob()
    const element = mockElement()
    element.evaluate = vi.fn().mockResolvedValue('')
    const result = await job['isDisabled'](element)
    expect(result).toBe(false)
  })
})

describe('reset', () => {
  it('should set the style element to inherit', async () => {
    const job = new NovaJob()
    const element = mockElement()
    element.evaluate = vi.fn().mockImplementation((fn) => {
      const domElement = { setAttribute: vi.fn() }
      fn(domElement)
      expect(domElement.setAttribute).toHaveBeenCalledWith('style', 'inherit')
    })
    await job['reset'](element)
    expect(element.evaluate).toHaveBeenCalled()
  })
})

describe('validateDisplay', () => {
  it('should return true if last element is more recent than target hour', async () => {
    const job = new NovaJob()
    const element = mockElement()
    element.$eval = vi.fn().mockResolvedValue('11:00')
    const result = await job['validateDisplay']([element], '12:00')
    expect(result).toBe(true)
  })

  it('should return false if last element is older than target hour', async () => {
    const job = new NovaJob()
    const element = mockElement()
    element.$eval = vi.fn().mockResolvedValue('13:00')
    const result = await job['validateDisplay']([element], '12:00')
    expect(result).toBe(false)
  })

  it("should return false if time of last element doesn't exist", async () => {
    const job = new NovaJob()
    const element = mockElement()
    element.$eval = vi.fn().mockResolvedValue(null)
    const result = await job['validateDisplay']([element], '12:00')
    expect(result).toBe(false)
  })
})

describe('extract', () => {
  function createJob() {
    const job = new NovaJob()
    job['logger'] = new MockedLogger()
    return job
  }

  it('should extract artist, title and hour of each element', async () => {
    const job = createJob()
    const element1 = mockElement()
    const element2 = mockElement()
    await job['extract']([element1, element2], '03/21/2024', '12:12')
    expect(element1.$eval).toHaveBeenCalledWith('h2', expect.any(Function))
    expect(element1.$eval).toHaveBeenCalledWith('p:nth-of-type(2)', expect.any(Function))
    expect(element1.$eval).toHaveBeenCalledWith('.time', expect.any(Function))
    expect(element2.$eval).toHaveBeenCalledWith('h2', expect.any(Function))
    expect(element2.$eval).toHaveBeenCalledWith('p:nth-of-type(2)', expect.any(Function))
    expect(element2.$eval).toHaveBeenCalledWith('.time', expect.any(Function))
  })

  it('should record the date of the most recent element', async () => {
    const job = createJob()
    const element1 = mockElement()
    const element2 = mockElement()
    element1.$eval = vi.fn().mockResolvedValue('23:00')
    await job['extract']([element1, element2], '03/21/2024', '12:12')
    expect(setTempDate).toHaveBeenCalledWith('03/21/2024', '23:00')
    expect(setTempDate).toHaveBeenCalledTimes(1)
  })

  it("should stop when element's hour is older than target hour", async () => {
    const job = createJob()
    const element1 = mockElement()
    const element2 = mockElement()
    element1.$eval = vi.fn().mockResolvedValue('10:00')
    await job['extract']([element1, element2], '03/21/2024', '12:12')
    expect(element2.$eval).not.toHaveBeenCalled()
  })

  it('should return tracks platforms id, title and artist', async () => {
    const job = createJob()
    const element = mockElement()
    element.$eval = vi.fn().mockResolvedValueOnce('artist').mockResolvedValueOnce('title')
    element.$$eval = vi
      .fn()
      .mockResolvedValue([
        'https://open.spotify.com/track/1h2xVEoJORqrg71HocgqXd',
        'https://www.deezer.com/track/596034702',
        'https://itunes.apple.com/WebObjects/MZStore.woa/wa/',
      ])
    const result = await job['extract']([element], '03/21/2024', '12:12')
    expect(result).toEqual([
      { artist: 'artist', deezerId: '596034702', spotifyId: '1h2xVEoJORqrg71HocgqXd', title: 'title' },
    ])
  })

  it('should replace track platform id', async () => {
    const job = createJob()
    const element = mockElement()
    element.$eval = vi.fn().mockResolvedValueOnce('artist').mockResolvedValueOnce('title')
    element.$$eval = vi.fn().mockResolvedValue(['https://open.spotify.com/track/1julw87xjTSzLLqAv8aNab'])
    const result = await job['extract']([element], '03/21/2024', '12:12')
    expect(result).toEqual([
      { artist: 'artist', deezerId: undefined, spotifyId: '5vmRQ3zELMLUQPo2FLQ76x', title: 'title' },
    ])
  })

  it('should remove track platform id', async () => {
    const job = createJob()
    const element = mockElement()
    element.$eval = vi.fn().mockResolvedValueOnce('artist').mockResolvedValueOnce('title')
    element.$$eval = vi.fn().mockResolvedValue(['https://open.spotify.com/track/4LRPiXqCikLlN15c3yImP7'])
    const result = await job['extract']([element], '03/21/2024', '12:12')
    expect(result).toEqual([{ artist: 'artist', deezerId: undefined, spotifyId: '', title: 'title' }])
  })

  it('should log success', async () => {
    const job = createJob()
    const { success } = mockAction(job['logger'])
    const element = mockElement()
    await job['extract']([element], '03/21/2024', '12:12')
    expect(success).toHaveBeenCalledWith({ nbItems: 1 })
  })

  it('should log failure and throw', async () => {
    const job = createJob()
    const { failure } = mockAction(job['logger'])
    const element = mockElement()
    element.$eval = vi.fn().mockRejectedValue(new Error('500'))
    await expect(job['extract']([element], '03/21/2024', '12:12')).rejects.toThrow()
    expect(failure).toHaveBeenCalledWith(new Error('500'))
  })
})
