import {
  GrowthReference,
  REFERENCE_MAX_AGE_DAYS,
  lmsAt,
  percentileValue,
  percentilesAt,
} from './growth-reference';

const two = (values: object) =>
  Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Math.round(v * 100) / 100]));

/** A boy's weight on the WHO rows of days 0, 7 and 1826 (weianthro.txt), the rest made up. */
const table = { l: [0.3487, 0.2303, -0.1615], m: [3.3464, 3.6497, 18.3328], s: [0.14602, 0.13858, 0.13615] };
const reference: GrowthReference = {
  source: 'WHO',
  licence: 'GPL-3',
  ageDays: [0, 7, 1826],
  boy: { weight: table, length: table, head: table },
  girl: {
    weight: { l: [1, 1, 1], m: [10, 20, 30], s: [0.1, 0.1, 0.1] },
    length: table,
    head: table,
  },
};

describe('growth reference', () => {
  it('reads L, M and S on a row', () => {
    expect(lmsAt(reference.boy.weight, reference.ageDays, 7)).toEqual({
      l: 0.2303,
      m: 3.6497,
      s: 0.13858,
    });
  });

  it('interpolates L, M and S linearly between two rows', () => {
    const lms = lmsAt(reference.girl.weight, reference.ageDays, 3.5)!;
    expect(lms.m).toBeCloseTo(15, 10);
    expect(lms.l).toBe(1);
  });

  it('has nothing before birth nor after 1826 days', () => {
    expect(REFERENCE_MAX_AGE_DAYS).toBe(1826);
    expect(lmsAt(reference.boy.weight, reference.ageDays, 1826)).not.toBeNull();
    expect(lmsAt(reference.boy.weight, reference.ageDays, 1827)).toBeNull();
    expect(lmsAt(reference.boy.weight, reference.ageDays, -1)).toBeNull();
    expect(percentilesAt(reference, 'boy', 'weight', 1827)).toBeNull();
  });

  it('gives a percentile value as M × (1 + L × S × z)^(1/L)', () => {
    expect(percentileValue({ l: 1, m: 50, s: 0.04 }, 1)).toBeCloseTo(52, 10);
    expect(percentileValue({ l: 0.5, m: 4, s: 0.1 }, -2)).toBeCloseTo(4 * 0.9 ** 2, 10);
  });

  it('uses M × exp(S × z) when L is 0', () => {
    expect(percentileValue({ l: 0, m: 4, s: 0.1 }, 1)).toBeCloseTo(4 * Math.exp(0.1), 10);
  });

  it("gives a boy's weight at birth as 2.51 / 2.86 / 3.35 / 3.88 / 4.35 kg", () => {
    expect(two(percentilesAt(reference, 'boy', 'weight', 0)!)).toEqual({
      p3: 2.51,
      p15: 2.86,
      p50: 3.35,
      p85: 3.88,
      p97: 4.35,
    });
  });

  it("uses the given sex's table", () => {
    expect(percentilesAt(reference, 'girl', 'weight', 0)!.p50).toBe(10);
  });
});
