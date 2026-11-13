export function relativeTime(iso: string): string {
  const seconds = (Date.now() - Date.parse(iso)) / 1000
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return plural(Math.floor(seconds / 60), 'minute')
  if (seconds < 86_400) return plural(Math.floor(seconds / 3600), 'hour')
  if (seconds < 7 * 86_400) return plural(Math.floor(seconds / 86_400), 'day')
  const date = new Date(iso)
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
}

function plural(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? '' : 's'} ago`
}
