import { isLiveLongerThan } from './live-longer-than';

const HOUR = 60 * 60 * 1000;
const start = '2026-10-03T10:00:00Z';
const now = (minutes: number) => Date.parse(start) + minutes * 60_000;

describe('isLiveLongerThan', () => {
  it('holds for a live entry started more than the given time ago', () => {
    expect(isLiveLongerThan({ startTime: start, endTime: null }, HOUR, now(61))).toBe(true);
  });

  it('does not hold up to the given time', () => {
    expect(isLiveLongerThan({ startTime: start, endTime: null }, HOUR, now(60))).toBe(false);
  });

  it('never holds for a stopped entry', () => {
    expect(
      isLiveLongerThan({ startTime: start, endTime: '2026-10-03T10:20:00Z' }, HOUR, now(300)),
    ).toBe(false);
  });
});
