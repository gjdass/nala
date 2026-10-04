import { spanSeconds } from './span-seconds';

describe('spanSeconds', () => {
  it('is the whole seconds from the start to the end', () => {
    expect(
      spanSeconds({ startTime: '2026-10-03T10:00:00Z', endTime: '2026-10-03T10:20:30.900Z' }),
    ).toBe(1230);
  });

  it('runs to now while there is no end', () => {
    const now = Date.parse('2026-10-03T10:05:00Z');
    expect(spanSeconds({ startTime: '2026-10-03T10:00:00Z', endTime: null }, now)).toBe(300);
  });

  it('is null without an end and without now', () => {
    expect(spanSeconds({ startTime: '2026-10-03T10:00:00Z', endTime: null })).toBeNull();
  });
});
