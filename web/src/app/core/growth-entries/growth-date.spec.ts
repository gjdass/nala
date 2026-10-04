import { FormControl } from '@angular/forms';
import { notBeforeBirth, today } from './growth-date';

describe('growth dates', () => {
  afterEach(() => vi.useRealTimers());

  it('today() is the local midnight of the current day', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 3, 23, 59));

    expect(today()).toEqual(new Date(2026, 9, 3));
  });

  describe('notBeforeBirth()', () => {
    const check = (value: Date | null, birthDate: string | null) =>
      notBeforeBirth(() => birthDate)(new FormControl<Date | null>(value));

    it('accepts the birth date and later', () => {
      expect(check(new Date(2026, 8, 1), '2026-09-01')).toBeNull();
      expect(check(new Date(2026, 8, 2), '2026-09-01')).toBeNull();
    });

    it('refuses a date before the birth date', () => {
      expect(check(new Date(2026, 7, 31), '2026-09-01')).toEqual({ beforeBirth: true });
    });

    it('checks nothing without a date or a birth date', () => {
      expect(check(null, '2026-09-01')).toBeNull();
      expect(check(new Date(2020, 0, 1), null)).toBeNull();
    });
  });
});
