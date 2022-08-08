import moment, { Moment } from 'moment'

export function formatDate(date: number): Moment {
  return moment.utc(date)
}
