import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HealthService, HealthStatus } from './health.service';

describe('HealthService', () => {
  let service: HealthService;
  let http: HttpTestingController;
  let result: HealthStatus[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(HealthService);
    http = TestBed.inject(HttpTestingController);
    result = [];
    service.check().subscribe((status) => result.push(status));
  });

  afterEach(() => http.verify());

  it('requests GET /api/health', () => {
    const req = http.expectOne('/api/health');
    expect(req.request.method).toBe('GET');
    req.flush({ status: 'ok' });
  });

  it('emits ok when the API answers 200 {status: "ok"}', () => {
    http.expectOne('/api/health').flush({ status: 'ok' });
    expect(result).toEqual(['ok']);
  });

  it('emits unavailable when the API answers 503', () => {
    http
      .expectOne('/api/health')
      .flush({ status: 'unavailable' }, { status: 503, statusText: 'Service Unavailable' });
    expect(result).toEqual(['unavailable']);
  });

  it('emits unavailable on a network error', () => {
    http.expectOne('/api/health').error(new ProgressEvent('error'));
    expect(result).toEqual(['unavailable']);
  });
});
