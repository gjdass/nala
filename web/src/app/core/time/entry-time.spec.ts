import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { translocoTesting } from '../../testing/transloco-testing';
import { EntryDatePipe, EntryTimePipe } from './entry-time';

const NOW = new Date(2026, 8, 28, 12, 0, 0);
const at = (y: number, m: number, d: number, h: number, min: number) =>
  new Date(y, m, d, h, min).toISOString();
const time = (lang: string, iso: string) =>
  new Intl.DateTimeFormat(lang, { timeStyle: 'short' }).format(new Date(iso));

describe('EntryTimePipe', () => {
  let transloco: TranslocoService;
  let pipe: EntryTimePipe;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(NOW);
    TestBed.configureTestingModule({ imports: [translocoTesting()] });
    transloco = TestBed.inject(TranslocoService);
    pipe = TestBed.runInInjectionContext(() => new EntryTimePipe());
  });

  afterEach(() => vi.useRealTimers());

  it('shows only the local time for today', () => {
    const iso = at(2026, 8, 28, 0, 5);
    expect(pipe.transform(iso)).toBe(time('en', iso));
  });

  it('says today before the time when asked (entry sheet rows)', () => {
    const iso = at(2026, 8, 28, 0, 5);
    expect(pipe.transform(iso, true)).toBe(`Today ${time('en', iso)}`);
  });

  it('says yesterday for the day before', () => {
    const iso = at(2026, 8, 27, 23, 50);
    expect(pipe.transform(iso)).toBe(`Yesterday ${time('en', iso)}`);
  });

  it('shows the date and time for older entries of this year', () => {
    const iso = at(2026, 8, 20, 14, 10);
    const expected = new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
    expect(pipe.transform(iso)).toBe(expected);
  });

  it('adds the year for another year', () => {
    const iso = at(2025, 11, 31, 14, 10);
    expect(pipe.transform(iso)).toContain('2025');
  });

  it('formats in French', () => {
    transloco.setActiveLang('fr');
    const iso = at(2026, 8, 27, 9, 30);

    expect(pipe.transform(iso)).toBe(`Hier ${time('fr', iso)}`);
  });
});

describe('EntryDatePipe', () => {
  let transloco: TranslocoService;
  let pipe: EntryDatePipe;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(NOW);
    TestBed.configureTestingModule({ imports: [translocoTesting()] });
    transloco = TestBed.inject(TranslocoService);
    pipe = TestBed.runInInjectionContext(() => new EntryDatePipe());
  });

  afterEach(() => vi.useRealTimers());

  it('says today for any time today, without the time', () => {
    expect(pipe.transform(new Date(2026, 8, 28))).toBe('Today');
    expect(pipe.transform(at(2026, 8, 28, 23, 59))).toBe('Today');
  });

  it('says yesterday for the day before', () => {
    expect(pipe.transform(new Date(2026, 8, 27))).toBe('Yesterday');
  });

  it('shows the date of older days of this year, without the time', () => {
    expect(pipe.transform(new Date(2026, 8, 20))).toBe(
      new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(
        new Date(2026, 8, 20),
      ),
    );
    expect(pipe.transform(new Date(2026, 8, 20))).toBe('Sep 20');
  });

  it('adds the year for another year', () => {
    expect(pipe.transform(new Date(2025, 11, 31))).toBe('Dec 31, 2025');
  });

  it('formats in French', () => {
    transloco.setActiveLang('fr');

    expect(pipe.transform(new Date(2026, 8, 28))).toBe("Aujourd'hui");
    expect(pipe.transform(new Date(2026, 8, 27))).toBe('Hier');
    expect(pipe.transform(new Date(2026, 8, 20))).toBe('20 sept.');
  });
});
