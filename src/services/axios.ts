import axios, { AxiosRequestConfig } from 'axios'

export const Axios = {
  get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return axios.get<T>(url, config).then((d) => d.data)
  },
  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return axios.post<T>(url, data, config).then((d) => d.data)
  },
  put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return axios.put<T>(url, data, config).then((d) => d.data)
  },
  delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return axios.delete<T>(url, config).then((d) => d.data)
  },
}
