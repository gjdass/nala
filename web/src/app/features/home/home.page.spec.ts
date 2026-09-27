import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import en from '../../../../public/i18n/en.json';
import { HealthService, HealthStatus } from '../../core/health/health.service';
import { ThemeMode, ThemeService } from '../../core/theme/theme.service';
import { translocoTesting } from '../../testing/transloco-testing';
import { HomePage } from './home.page';

describe('HomePage', () => {
  let fixture: ComponentFixture<HomePage>;
  let health: Subject<HealthStatus>;
  let theme: { mode: ReturnType<typeof signal<ThemeMode>>; setMode: ReturnType<typeof vi.fn> };

  const host = () => fixture.nativeElement as HTMLElement;
  const toggle = (testId: string) =>
    host().querySelector<HTMLButtonElement>(`mat-button-toggle[data-testid="${testId}"] button`);

  const text = (selector: string) =>
    (fixture.nativeElement as HTMLElement).querySelector(selector)?.textContent?.trim();

  beforeEach(async () => {
    health = new Subject<HealthStatus>();
    theme = { mode: signal<ThemeMode>('system'), setMode: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [HomePage, translocoTesting()],
      providers: [
        { provide: HealthService, useValue: { check: () => health } },
        { provide: ThemeService, useValue: theme },
      ],
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

    toggle('lang-fr')?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance).toBe(instance);
    expect(text('[data-testid="health-status"]')).toBe('Indisponible');
    expect(text('[data-testid="api-status-label"]')).toBe("État de l'API :");
  });

  it('selecting Dark sets the theme to dark', async () => {
    toggle('theme-dark')?.click();
    await fixture.whenStable();
    expect(theme.setMode).toHaveBeenCalledWith('dark');
  });

  it('marks the current theme as selected', () => {
    const checked = host().querySelector(
      'mat-button-toggle.mat-button-toggle-checked[data-testid^="theme-"]',
    );
    expect(checked?.getAttribute('data-testid')).toBe('theme-system');
  });
});
