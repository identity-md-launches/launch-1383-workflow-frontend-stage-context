export const SECONDS_PER_DAY = 86_400;

/** UTC day index as the contract computes it: timestamp / 1 days. */
export function dayIndex(unixSeconds: number): number {
  return Math.floor(unixSeconds / SECONDS_PER_DAY);
}

export function todayIndex(now: Date = new Date()): number {
  return dayIndex(Math.floor(now.getTime() / 1000));
}

/** ISO date (YYYY-MM-DD) of a UTC day index. */
export function dayToIso(day: number): string {
  return new Date(day * SECONDS_PER_DAY * 1000).toISOString().slice(0, 10);
}

export function isoToDay(iso: string): number {
  const t = Date.parse(iso + 'T00:00:00Z');
  if (Number.isNaN(t)) throw new Error(`bad ISO date ${iso}`);
  return dayIndex(t / 1000);
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "Monday, 12 October 2026" */
export function longDate(day: number): string {
  const d = new Date(day * SECONDS_PER_DAY * 1000);
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "12 Oct" */
export function shortDate(day: number): string {
  const d = new Date(day * SECONDS_PER_DAY * 1000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]!.slice(0, 3)}`;
}

export function weekdayShort(day: number): string {
  return WEEKDAYS[new Date(day * SECONDS_PER_DAY * 1000).getUTCDay()]!.slice(0, 3);
}

/** The inclusive window book() accepts: tomorrow to 30 days ahead. */
export function bookingWindow(today: number, maxDaysAhead = 30): { first: number; last: number } {
  return { first: today + 1, last: today + maxDaysAhead };
}

export function dayHasEnded(day: number, nowSeconds: number): boolean {
  return nowSeconds >= (day + 1) * SECONDS_PER_DAY;
}

export function dayHasStarted(day: number, nowSeconds: number): boolean {
  return nowSeconds >= day * SECONDS_PER_DAY;
}
