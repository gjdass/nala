import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { Subject } from 'rxjs';
import en from '../../../../public/i18n/en.json';
import fr from '../../../../public/i18n/fr.json';
import { HealthService, HealthStatus } from '../../core/health/health.service';
import { HomePage } from './home.page';

describe('HomePage', () => {
  let fixture: ComponentFixture<HomePage>;
  let health: Subject<HealthStatus>;

  const text = (selector: string) =>
    (fixture.nativeElement as HTMLElement).querySelector(selector)?.textContent?.trim();

  beforeEach(async () => {
    health = new Subject<HealthStatus>();
    await TestBed.configureTestingModule({
      imports: [
        HomePage,
        TranslocoTestingModule.forRoot({
          langs: { en, fr },
          translocoConfig: {
            availableLangs: ['en', 'fr'],
            defaultLang: 'en',
            reRenderOnLangChange: true,
          },
          preloadLangs: true,
        }),
      ],
      providers: [{ provide: HealthService, useValue: { check: () => health } }],
    }).compileComponents();
    fixture = TestBed.createComponent(HomePage);
    await fixture.whenStable();
  });

  it('shows "loading" before the health check answers', () => {
    expect(text('[data-testid="health-status"]')).toBe(en.health.loading);
  });

  it('shows the ok status when the API is healthy', async () => {
    health.next('ok');
    await fixture.whenStable();
    expect(text('[data-testid="health-status"]')).toBe(en.health.ok);
  });

  it('shows the unavailable status when the API is down', async () => {
    health.next('unavailable');
    await fixture.whenStable();
    expect(text('[data-testid="health-status"]')).toBe(en.health.unavailable);
  });

  it('switches the displayed text to French without reloading', async () => {
    health.next('unavailable');
    await fixture.whenStable();
    const instance = fixture.componentInstance;

    const frButton = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[data-testid="lang-fr"]',
    );
    frButton?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance).toBe(instance);
    expect(text('[data-testid="health-status"]')).toBe('Indisponible');
    expect(text('[data-testid="api-status-label"]')).toBe("État de l'API :");
  });
});
