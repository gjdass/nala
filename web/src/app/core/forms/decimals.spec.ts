import { FormControl } from '@angular/forms';
import { decimals } from './decimals';

describe('decimals', () => {
  const check = (digits: number, value: number | null) =>
    decimals(digits)(new FormControl<number | null>(value));

  it('accepts no value and values with up to the given decimals', () => {
    expect(check(1, null)).toBeNull();
    expect(check(1, 55)).toBeNull();
    expect(check(1, 55.5)).toBeNull();
    expect(check(3, 4.25)).toBeNull();
    expect(check(3, 4.125)).toBeNull();
  });

  it('refuses more decimals', () => {
    expect(check(1, 55.55)).toEqual({ decimals: true });
    expect(check(3, 4.1255)).toEqual({ decimals: true });
  });
});
