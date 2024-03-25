import moment from 'moment'

let tempDate: number

export function getTempDate() {
  return tempDate
}

export function setTempDate(date: string, hour: string) {
  const dateFormat = 'MM/DD/YYYY HH:mm'
  tempDate = moment(`${date} ${hour}`, dateFormat).utcOffset('+02:00').valueOf()
}
