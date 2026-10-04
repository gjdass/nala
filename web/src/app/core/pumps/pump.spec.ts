import { aPump } from '../../testing/pumps';
import { pumpTotalMl } from './pump';

describe('pumpTotalMl', () => {
  it('adds both sides', () => {
    expect(pumpTotalMl(aPump({ leftMl: 90, rightMl: 80 }))).toBe(170);
  });

  it('counts a side without a volume as 0', () => {
    expect(pumpTotalMl(aPump({ leftMl: 90, rightMl: null }))).toBe(90);
    expect(pumpTotalMl(aPump({ leftMl: null, rightMl: 0 }))).toBe(0);
  });

  it('is null when neither side has a volume', () => {
    expect(pumpTotalMl(aPump({ leftMl: null, rightMl: null }))).toBeNull();
  });
});
