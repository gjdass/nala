import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { provideNalaI18n } from './i18n.providers';

describe('provideNalaI18n', () => {
  let transloco: TranslocoService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideNalaI18n('fr')],
    });
    transloco = TestBed.inject(TranslocoService);
    http = TestBed.inject(HttpTestingController);
  });

  it('starts in the given language', () => {
    expect(transloco.getActiveLang()).toBe('fr');
  });

  it('loads translations from i18n/<lang>.json', () => {
    const received: string[] = [];
    transloco.load('en').subscribe(() => received.push('en'));
    http.expectOne('i18n/en.json').flush({ app: { title: 'Nala' } });
    expect(received).toEqual(['en']);
  });

  it('keeps <html lang> in sync with the active language', () => {
    const doc = TestBed.inject(DOCUMENT);
    expect(doc.documentElement.lang).toBe('fr');
    transloco.setActiveLang('en');
    expect(doc.documentElement.lang).toBe('en');
  });
});
