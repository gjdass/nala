import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SectionPreference, SectionsSaveResult } from './section.models';
import { SectionPreferencesService } from './section-preferences.service';

describe('SectionPreferencesService', () => {
  let service: SectionPreferencesService;
  let http: HttpTestingController;

  const defaults: SectionPreference[] = [
    { key: 'feed', visible: true },
    { key: 'sleep', visible: true },
    { key: 'diaper', visible: true },
    { key: 'pump', visible: true },
    { key: 'growth', visible: true },
    { key: 'health', visible: true },
  ];
  const custom: SectionPreference[] = [
    { key: 'pump', visible: true },
    { key: 'feed', visible: true },
    { key: 'sleep', visible: false },
    { key: 'diaper', visible: true },
    { key: 'growth', visible: true },
    { key: 'health', visible: true },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SectionPreferencesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const loadDefaults = () => {
    service.load();
    http.expectOne('/api/account/sections').flush(defaults);
  };

  describe('load()', () => {
    it('is null until loaded', () => {
      expect(service.preferences()).toBeNull();
    });

    it("gets /api/account/sections and exposes the user's list", () => {
      service.load();
      const req = http.expectOne('/api/account/sections');
      expect(req.request.method).toBe('GET');
      req.flush(defaults);

      expect(service.preferences()).toEqual(defaults);
    });
  });

  describe('save()', () => {
    it('puts the whole list and shows it right away', async () => {
      loadDefaults();

      const result = firstValueFrom(service.save(custom));
      expect(service.preferences()).toEqual(custom);
      const req = http.expectOne('/api/account/sections');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(custom);
      req.flush(custom);

      expect(await result).toEqual<SectionsSaveResult>({ ok: true });
      expect(service.preferences()).toEqual(custom);
    });

    it('puts the previous list back when saving fails', async () => {
      loadDefaults();

      const result = firstValueFrom(service.save(custom));
      http
        .expectOne('/api/account/sections')
        .flush(
          { errors: { sections: ['noneVisible'] } },
          { status: 400, statusText: 'Bad Request' },
        );

      expect(await result).toEqual<SectionsSaveResult>({
        ok: false,
        errors: { sections: 'noneVisible' },
      });
      expect(service.preferences()).toEqual(defaults);
    });
  });
});
