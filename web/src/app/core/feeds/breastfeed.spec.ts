import { aBreastfeed, aSegment } from '../../testing/feeds';
import { endedOnSide, isStillFeeding, runningSide, sideSeconds, totalSeconds } from './breastfeed';

const at = (time: string) => new Date(`2026-09-30T${time}Z`).getTime();

describe('breastfeed durations', () => {
  const inProgress = aBreastfeed({
    endTime: null,
    segments: [
      aSegment('left', '2026-09-30T10:00:00Z', '2026-09-30T10:05:00Z'),
      aSegment('right', '2026-09-30T10:05:00Z', '2026-09-30T10:07:00Z'),
      aSegment('left', '2026-09-30T10:07:00Z', null),
    ],
  });

  it('sums the segments of each side, from their stored timestamps', () => {
    const feed = aBreastfeed();

    expect(sideSeconds(feed, 'left', at('11:00:00'))).toBe(300);
    expect(sideSeconds(feed, 'right', at('11:00:00'))).toBe(210);
    expect(totalSeconds(feed, at('11:00:00'))).toBe(510);
  });

  it('counts the running segment up to now', () => {
    expect(sideSeconds(inProgress, 'left', at('10:10:30'))).toBe(300 + 210);
    expect(sideSeconds(inProgress, 'right', at('10:10:30'))).toBe(120);
  });

  it('knows the running side, none once paused or saved', () => {
    expect(runningSide(inProgress)).toBe('left');
    expect(runningSide(aBreastfeed())).toBeNull();
  });

  it('ended on the side of the last segment', () => {
    expect(endedOnSide(aBreastfeed())).toBe('right');
    expect(endedOnSide(inProgress)).toBe('left');
    expect(endedOnSide(aBreastfeed({ segments: [] }))).toBeNull();
  });

  it('is zero without segments', () => {
    const empty = aBreastfeed({ segments: [] });

    expect(totalSeconds(empty, at('11:00:00'))).toBe(0);
    expect(runningSide(empty)).toBeNull();
  });
});

describe('isStillFeeding', () => {
  const started = aBreastfeed({ startTime: '2026-09-30T10:00:00Z', endTime: null });

  it('is true once a feed in progress started more than 3 hours ago', () => {
    expect(isStillFeeding(started, at('13:00:01'))).toBe(true);
  });

  it('is false up to 3 hours', () => {
    expect(isStillFeeding(started, at('13:00:00'))).toBe(false);
    expect(isStillFeeding(started, at('10:30:00'))).toBe(false);
  });

  it('is false for a saved feed', () => {
    expect(isStillFeeding(aBreastfeed(), at('20:00:00'))).toBe(false);
  });
});
