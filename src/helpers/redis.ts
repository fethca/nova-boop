import { DateTime } from 'luxon'

let tempDate: number

export function getTempDate() {
  return tempDate
}

export function setTempDate(date: string, hour: string) {
  const parisDate = DateTime.fromFormat(`${date} ${hour}`, 'MM/dd/yyyy HH:mm', { zone: 'Europe/Paris' })
  tempDate = parisDate.toUTC().toMillis()
}
