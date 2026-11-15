import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { GrowthReference } from './growth-reference';
import { GrowthReferenceService } from './growth-reference.service';

const reference = { source: 'WHO', licence: 'GPL-3', ageDays: [0] } as unknown as GrowthReference;

describe('GrowthReferenceService', () => {
  let service: GrowthReferenceService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GrowthReferenceService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads nothing until first used', () => {
    http.expectNone('/reference/who-growth.json');
  });

  it('loads the reference file once, on first use', async () => {
    const first = firstValueFrom(service.reference());
    const second = firstValueFrom(service.reference());
    http.expectOne('/reference/who-growth.json').flush(reference);
    expect(await first).toEqual(reference);
    expect(await second).toEqual(reference);

    expect(await firstValueFrom(service.reference())).toEqual(reference);
    http.expectNone('/reference/who-growth.json');
  });

  it('tries again on the next use after a failed load', async () => {
    const failed = firstValueFrom(service.reference());
    http
      .expectOne('/reference/who-growth.json')
      .flush('', { status: 404, statusText: 'Not Found' });
    await expect(failed).rejects.toBeTruthy();

    const retried = firstValueFrom(service.reference());
    http.expectOne('/reference/who-growth.json').flush(reference);
    expect(await retried).toEqual(reference);
  });
});
