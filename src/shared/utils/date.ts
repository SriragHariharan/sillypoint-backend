// Today's date as YYYY-MM-DD in the given time zone
export const todayInTimezone = (timeZone: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())

// True if the text is a real calendar date written as YYYY-MM-DD
export const isRealDate = (value: string) => {
    const date = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}
