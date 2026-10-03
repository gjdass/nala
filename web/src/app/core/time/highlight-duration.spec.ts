import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { translocoTesting } from '../../testing/transloco-testing';
import { HighlightDurationPipe } from './highlight-duration';

const MIN = 60;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('HighlightDurationPipe', () => {
  let transloco: TranslocoService;
  let pipe: HighlightDurationPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [translocoTesting()] });
    transloco = TestBed.inject(TranslocoService);
    pipe = TestBed.runInInjectionContext(() => new HighlightDurationPipe());
  });

  it('formats in hours and minutes only, in English', () => {
    expect(pipe.transform(0)).toBe('<1m');
    expect(pipe.transform(59)).toBe('<1m');
    expect(pipe.transform(MIN)).toBe('1m');
    expect(pipe.transform(26 * MIN + 59)).toBe('26m');
    expect(pipe.transform(2 * HOUR + 15 * MIN + 30)).toBe('2h 15m');
    expect(pipe.transform(2 * HOUR + 30)).toBe('2h');
    expect(pipe.transform(DAY - 1)).toBe('23h 59m');
  });

  it('caps at >24h from 24 hours on', () => {
    expect(pipe.transform(DAY)).toBe('>24h');
    expect(pipe.transform(3 * DAY)).toBe('>24h');
  });

  it('reads a negative duration as under a minute', () => {
    expect(pipe.transform(-30)).toBe('<1m');
  });

  it('formats in French and follows a language change', () => {
    transloco.setActiveLang('fr');

    expect(pipe.transform(30)).toBe('<1 min');
    expect(pipe.transform(26 * MIN)).toBe('26 min');
    expect(pipe.transform(2 * HOUR + 15 * MIN)).toBe('2 h 15 min');
    expect(pipe.transform(2 * HOUR)).toBe('2 h');
    expect(pipe.transform(DAY)).toBe('>24 h');
  });
});
