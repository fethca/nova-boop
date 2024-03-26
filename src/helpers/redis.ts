import moment from 'moment-timezone'

let tempDate: number

export function getTempDate() {
  return tempDate
}

export function setTempDate(date: string, hour: string) {
  const dateFormat = 'MM/DD/YYYY HH:mm'
  tempDate = moment(`${date} ${hour}`, dateFormat).tz('Europe/Paris').valueOf()
}
