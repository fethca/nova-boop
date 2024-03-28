import moment from 'moment-timezone'
import { franceTZ } from './utils.js'

let tempDate: number

export function getTempDate() {
  return tempDate
}

export function setTempDate(date: string, hour: string) {
  const dateFormat = 'MM/DD/YYYY HH:mm'
  const frenchDate = franceTZ(moment(`${date} ${hour}`, dateFormat))
  tempDate = frenchDate.utc().valueOf()
}
