const dateTime = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
})

const date = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" })

export function formatDateTime(value: string): string {
  return dateTime.format(new Date(value))
}

export function formatDate(value: string): string {
  return date.format(new Date(value))
}
