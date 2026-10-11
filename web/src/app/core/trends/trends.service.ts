import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { formatDate } from '../time/local-date';
import { SleepTrendDay, TrendsPeriod } from './trends.models';

/**
 * A baby's trends (spec 12), aggregated by the API per local day of the device's time zone. Reading
 * needs the network: errors when they can't be loaded (the page offers Try again).
 */
@Injectable({ providedIn: 'root' })
export class TrendsService {
  private readonly http = inject(HttpClient);

  /** The period's Sleep data days, in date order. */
  sleeps(babyId: string, period: TrendsPeriod): Observable<SleepTrendDay[]> {
    return this.days<SleepTrendDay>(babyId, 'sleeps', period);
  }

  private days<T>(babyId: string, section: string, period: TrendsPeriod): Observable<T[]> {
    const params = new HttpParams()
      .set('from', formatDate(period.from))
      .set('to', formatDate(period.to))
      .set('tz', Intl.DateTimeFormat().resolvedOptions().timeZone);
    return this.http
      .get<{ days: T[] }>(`/api/babies/${babyId}/trends/${section}`, { params })
      .pipe(map((response) => response.days));
  }
}
