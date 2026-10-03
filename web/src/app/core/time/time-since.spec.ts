import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { translocoTesting } from '../../testing/transloco-testing';
import { TimeSincePipe } from './time-since';

const NOW = new Date(2026, 8, 28, 12, 0, 0).getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

@Component({
  imports: [TimeSincePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span data-testid="since">{{ iso | nalaTimeSince }}</span>`,
})
class Host {
  readonly iso = ago(26 * MIN);
}

describe('TimeSincePipe', () => {
  let transloco: TranslocoService;
  let pipe: TimeSincePipe;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(NOW);
    TestBed.configureTestingModule({ imports: [translocoTesting()] });
    transloco = TestBed.inject(TranslocoService);
    pipe = TestBed.runInInjectionContext(() => new TimeSincePipe());
  });

  afterEach(() => vi.useRealTimers());

  it('formats in English', () => {
    expect(pipe.transform(ago(0))).toBe('just now');
    expect(pipe.transform(ago(59 * SEC))).toBe('just now');
    expect(pipe.transform(ago(MIN))).toBe('1m ago');
    expect(pipe.transform(ago(26 * MIN + 40 * SEC))).toBe('26m ago');
    expect(pipe.transform(ago(2 * HOUR + 15 * MIN))).toBe('2h 15m ago');
    expect(pipe.transform(ago(2 * HOUR + 30 * SEC))).toBe('2h ago');
    expect(pipe.transform(ago(DAY - SEC))).toBe('23h 59m ago');
    expect(pipe.transform(ago(DAY))).toBe('>24h ago');
    expect(pipe.transform(ago(3 * DAY + 5 * HOUR))).toBe('>24h ago');
  });

  it('formats in French', () => {
    transloco.setActiveLang('fr');

    expect(pipe.transform(ago(0))).toBe("à l'instant");
    expect(pipe.transform(ago(26 * MIN))).toBe('il y a 26 min');
    expect(pipe.transform(ago(2 * HOUR + 15 * MIN))).toBe('il y a 2 h 15 min');
    expect(pipe.transform(ago(2 * HOUR))).toBe('il y a 2 h');
    expect(pipe.transform(ago(DAY))).toBe('il y a plus de 24 h');
    expect(pipe.transform(ago(3 * DAY))).toBe('il y a plus de 24 h');
  });

  it('reads a time in the future as just now', () => {
    expect(pipe.transform(ago(-5 * MIN))).toBe('just now');
  });

  it('updates live in the page without any other change', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const since = () =>
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="since"]')?.textContent;
    expect(since()).toBe('26m ago');

    vi.advanceTimersByTime(MIN);
    await fixture.whenStable();

    expect(since()).toBe('27m ago');
  });
});
