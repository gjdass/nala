import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';

export type HealthStatus = 'ok' | 'unavailable';

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly http = inject(HttpClient);

  check(): Observable<HealthStatus> {
    return this.http.get<{ status?: string }>('/api/health').pipe(
      map((body): HealthStatus => (body?.status === 'ok' ? 'ok' : 'unavailable')),
      catchError(() => of<HealthStatus>('unavailable')),
    );
  }
}
