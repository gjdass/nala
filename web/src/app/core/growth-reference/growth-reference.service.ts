import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay, tap } from 'rxjs';
import { GrowthReference } from './growth-reference';

/**
 * The WHO growth reference shipped with the app (spec 12): loaded once, on first use, and kept for the
 * session; a failed load is tried again on the next use. The service worker caches the file.
 */
@Injectable({ providedIn: 'root' })
export class GrowthReferenceService {
  private readonly http = inject(HttpClient);
  private cached: Observable<GrowthReference> | null = null;

  reference(): Observable<GrowthReference> {
    this.cached ??= this.http.get<GrowthReference>('/reference/who-growth.json').pipe(
      tap({ error: () => (this.cached = null) }),
      shareReplay(1),
    );
    return this.cached;
  }
}
