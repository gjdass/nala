import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  DiaperTrendDay,
  FeedTrendDay,
  PumpTrendDay,
  SleepTrendDay,
} from './trends.models';
import { TrendsService } from './trends.service';

describe('TrendsService', () => {
  let service: TrendsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TrendsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it("loads the period's sleep days in the device's time zone", async () => {
    const days: SleepTrendDay[] = [
      { date: '2026-10-07', daySeconds: 3600, nightSeconds: 36000, longestSeconds: 18000 },
    ];
    const result = firstValueFrom(
      service.sleeps('b1', { from: new Date(2026, 9, 3), to: new Date(2026, 9, 9) }),
    );

    const request = http.expectOne((r) => r.url === '/api/babies/b1/trends/sleeps');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('from')).toBe('2026-10-03');
    expect(request.request.params.get('to')).toBe('2026-10-09');
    expect(request.request.params.get('tz')).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    request.flush({ days });

    expect(await result).toEqual(days);
  });

  it.each([
    ['diapers', [{ date: '2026-10-07', wet: 6, dirty: 2, count: 7 }] as DiaperTrendDay[]],
    ['pumps', [{ date: '2026-10-07', leftMl: 90, rightMl: 80, sessions: 2 }] as PumpTrendDay[]],
    [
      'feeds',
      [
        {
          date: '2026-10-07',
          count: { breastfeed: 6, bottle: 1, solids: 1 },
          bottleMl: { breastMilk: 0, formula: 120 },
          breastSeconds: { left: 1500, right: 1200 },
          gapSecondsSum: 21600,
          gapCount: 3,
        },
      ] as FeedTrendDay[],
    ],
  ] as const)("loads the period's %s days", async (section, days) => {
    const period = { from: new Date(2026, 9, 3), to: new Date(2026, 9, 9) };
    const result = firstValueFrom<unknown[]>(
      service[section]('b1', period),
    );

    const request = http.expectOne((r) => r.url === `/api/babies/b1/trends/${section}`);
    expect(request.request.params.get('from')).toBe('2026-10-03');
    expect(request.request.params.get('to')).toBe('2026-10-09');
    expect(request.request.params.get('tz')).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    request.flush({ days });

    expect(await result).toEqual(days);
  });
});
