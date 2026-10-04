import { diaperType } from './diaper';

describe('diaperType', () => {
  it('is wet, dirty, wet + dirty, or dry with neither', () => {
    expect(diaperType({ wet: true, dirty: false })).toBe('wet');
    expect(diaperType({ wet: false, dirty: true })).toBe('dirty');
    expect(diaperType({ wet: true, dirty: true })).toBe('wetDirty');
    expect(diaperType({ wet: false, dirty: false })).toBe('dry');
  });
});
