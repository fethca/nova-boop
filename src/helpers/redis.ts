import moment from 'moment-timezone'
import { franceTZ } from './utils.js'

let tempDate: number

export function getTempDate() {
  return tempDate
}

export function setTempDate(date: string, hour: string) {
  const dateFormat = 'MM/DD/YYYY HH:mm'
  tempDate = franceTZ(moment(`${date} ${hour}`, dateFormat)).valueOf()
}
