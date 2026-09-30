import { FormControl } from '@angular/forms';
import { notInFuture } from './not-in-future';

describe('notInFuture', () => {
  const NOW = new Date(2026, 8, 30, 12, 0, 0).getTime();
  const check = (offsetMs: number) =>
    new FormControl(
      new Date(NOW + offsetMs),
      notInFuture(() => NOW),
    ).errors;

  it('accepts now and the past', () => {
    expect(check(0)).toBeNull();
    expect(check(-3_600_000)).toBeNull();
  });

  it('accepts up to one minute ahead', () => {
    expect(check(60_000)).toBeNull();
  });

  it('refuses more than one minute ahead', () => {
    expect(check(61_000)).toEqual({ inFuture: true });
  });

  it('leaves an empty value to the required validator', () => {
    expect(
      new FormControl<Date | null>(
        null,
        notInFuture(() => NOW),
      ).errors,
    ).toBeNull();
  });
});
