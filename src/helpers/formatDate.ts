import moment from 'moment'

export function formatDate(date: number): string {
  return moment.utc(date).format('YYYY-MM-DD HH:mm:ss')
}
