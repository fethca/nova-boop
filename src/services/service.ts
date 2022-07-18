import { NovaResponse, OnNovaData } from '@src/models'
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios'

export class Service {
  async request<T = never>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    const token = await this.authService.refresh()
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...config.headers,
    }
    return this.limiter.schedule(() =>
      axios.request<T>({ ...config, headers, baseURL: this.baseURL, timeout: this.timeout })
    )
  }

  async fetchBatch<T>(
    endpoint: string,
    onData: OnNovaData<T>,
    query: Record<string, unknown>,
    pageSize = 10
  ): Promise<number> {
    const search = JSON.stringify(query)
    const limit = Math.min(pageSize, 100).toString()
    const params = new URLSearchParams({ search, limit, pagination_type: 'search_after' })
    let url: string | undefined = `/api/rest/v1/${endpoint}?${params}`
    let total = 0
    while (url) {
      const data: NovaResponse<T> = await this.request<NovaResponse<T>>({ method: 'get', url }).then((res) => res.data)
      if (data._embedded?.items?.length) {
        await onData(data._embedded.items)
        total += data._embedded.items.length
      }
      url = data._links?.next?.href
    }
    return total
  }
}
