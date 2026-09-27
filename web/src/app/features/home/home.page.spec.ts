import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import en from '../../../../public/i18n/en.json';
import { HealthService, HealthStatus } from '../../core/health/health.service';
import { translocoTesting } from '../../testing/transloco-testing';
import { HomePage } from './home.page';

describe('HomePage', () => {
  let fixture: ComponentFixture<HomePage>;
  let health: Subject<HealthStatus>;

  const host = () => fixture.nativeElement as HTMLElement;

  const text = (selector: string) =>
    (fixture.nativeElement as HTMLElement).querySelector(selector)?.textContent?.trim();

  beforeEach(async () => {
    health = new Subject<HealthStatus>();
    await TestBed.configureTestingModule({
      imports: [HomePage, translocoTesting()],
      providers: [provideRouter([]), { provide: HealthService, useValue: { check: () => health } }],
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

  it('links to the settings page', () => {
    const link = host().querySelector('a[data-testid="settings"]');
    expect(link?.getAttribute('href')).toBe('/settings');
    expect(link?.textContent?.trim()).toBe(en.settings.title);
  });
});
