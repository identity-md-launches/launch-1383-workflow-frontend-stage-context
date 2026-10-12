import { describe, expect, it } from 'vitest';
import { bookingWindow, dayHasEnded, dayHasStarted, dayIndex, dayToIso, isoToDay, longDate } from './days';

describe('day math matches ScoopFrontPage', () => {
  it('day = timestamp / 1 days', () => {
    expect(dayIndex(0)).toBe(0);
    expect(dayIndex(86_399)).toBe(0);
    expect(dayIndex(86_400)).toBe(1);
    // block 26175145 on 2026-10-12T08:18:35Z reported currentDay() == 20738
    expect(dayIndex(Math.floor(Date.parse('2026-10-12T08:18:35Z') / 1000))).toBe(20738);
  });
  it('round-trips ISO dates', () => {
    expect(dayToIso(20738)).toBe('2026-10-12');
    expect(isoToDay('2026-10-12')).toBe(20738);
    expect(longDate(20738)).toBe('Monday, 12 October 2026');
  });
  it('booking window is tomorrow..+30', () => {
    expect(bookingWindow(20738)).toEqual({ first: 20739, last: 20768 });
  });
  it('started / ended boundaries', () => {
    const d = 20738;
    expect(dayHasStarted(d, d * 86_400 - 1)).toBe(false);
    expect(dayHasStarted(d, d * 86_400)).toBe(true);
    expect(dayHasEnded(d, (d + 1) * 86_400 - 1)).toBe(false);
    expect(dayHasEnded(d, (d + 1) * 86_400)).toBe(true);
  });
});
