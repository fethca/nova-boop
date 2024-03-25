declare module 'puppeteer-extra-plugin-block-resources' {
  import { PuppeteerExtraPlugin } from 'puppeteer-extra-plugin'

  interface PluginOptions {
    blockedTypes?: Set<string>
    interceptResolutionPriority?: number
  }

  class BlockResourcesPlugin extends PuppeteerExtraPlugin {
    constructor(opts?: Partial<PluginOptions>)
  }

  export default function (options?: Partial<PluginOptions>): BlockResourcesPlugin
}
