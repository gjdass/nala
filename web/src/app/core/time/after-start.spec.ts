import { FormControl } from '@angular/forms';
import { afterStart } from './after-start';

describe('afterStart', () => {
  const start = new Date('2026-10-03T10:00:00Z');
  const check = (end: Date | null, from: Date | null = start) =>
    afterStart(() => from)(new FormControl(end));

  it('accepts an end after the start', () => {
    expect(check(new Date('2026-10-03T10:00:01Z'))).toBeNull();
  });

  it('refuses an end at or before the start', () => {
    expect(check(new Date(start))).toEqual({ beforeStart: true });
    expect(check(new Date('2026-10-03T09:59:00Z'))).toEqual({ beforeStart: true });
  });

  it('leaves empty values alone', () => {
    expect(check(null)).toBeNull();
    expect(check(new Date('2026-10-03T09:00:00Z'), null)).toBeNull();
  });
});
