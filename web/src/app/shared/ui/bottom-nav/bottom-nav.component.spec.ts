import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import en from '../../../../../public/i18n/en.json';
import { translocoTesting } from '../../../testing/transloco-testing';
import { BottomNavComponent } from './bottom-nav.component';

@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class EmptyPage {}

describe('BottomNavComponent', () => {
  let fixture: ComponentFixture<BottomNavComponent>;
  let router: Router;

  const host = () => fixture.nativeElement as HTMLElement;
  const items = () => [...host().querySelectorAll<HTMLAnchorElement>('a[data-testid="nav-item"]')];
  const active = () =>
    items()
      .filter((a) => a.getAttribute('aria-current') === 'page')
      .map((a) => a.getAttribute('href'));
  const visit = async (url: string) => {
    await router.navigateByUrl(url);
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BottomNavComponent, translocoTesting()],
      providers: [
        provideRouter(
          ['', 'history', 'history/:section', 'trends', 'settings'].map((path) => ({
            path,
            component: EmptyPage,
          })),
        ),
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(BottomNavComponent);
    await visit('/');
  });

  it('lists Dashboard, History, Trends and Settings in that order, as icons named by their aria-label', () => {
    expect(
      items().map((a) => [
        a.getAttribute('href'),
        a.querySelector('mat-icon')?.textContent?.trim(),
        a.getAttribute('aria-label'),
      ]),
    ).toEqual([
      ['/', 'dashboard', en.nav.dashboard],
      ['/history', 'history', en.nav.history],
      ['/trends', 'insights', en.nav.trends],
      ['/settings', 'settings', en.nav.settings],
    ]);
  });

  it('shows no visible text label, only icons', () => {
    expect(host().querySelector('[data-testid="nav-label"]')).toBeNull();
    expect(items().map((a) => a.textContent?.trim())).toEqual([
      'dashboard',
      'history',
      'insights',
      'settings',
    ]);
  });

  it('is a labelled navigation landmark', () => {
    expect(host().querySelector('nav')?.getAttribute('aria-label')).toBe(en.nav.label);
  });

  it.each([
    ['/', '/'],
    ['/history', '/history'],
    ['/trends', '/trends'],
    ['/settings', '/settings'],
  ])('on %s marks %s as the current destination, with the active indicator', async (url, href) => {
    await visit(url);

    expect(active()).toEqual([href]);
    const current = items().find((a) => a.getAttribute('href') === href)!;
    expect(current.querySelector('.indicator.active')).not.toBeNull();
    expect(host().querySelectorAll('.indicator.active')).toHaveLength(1);
  });

  it("keeps Dashboard active on a section's history page", async () => {
    await visit('/history/feed');

    expect(active()).toEqual(['/']);
  });

  it('uses no density override, so destinations keep their 48 dp touch targets', () => {
    expect(host().querySelector('[class*="density"]')).toBeNull();
  });
});

@Component({
  imports: [BottomNavComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nala-bottom-nav [withTimers]="withTimers()">
    <p data-testid="projected">Feeding · L</p>
  </nala-bottom-nav>`,
})
class TimersHost {
  readonly withTimers = signal(false);
}

describe('BottomNavComponent with running timers', () => {
  let fixture: ComponentFixture<TimersHost>;

  const host = () => fixture.nativeElement as HTMLElement;
  const pill = () => host().querySelector<HTMLElement>('[data-testid="nav-pill"]')!;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimersHost, translocoTesting()],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(TimersHost);
    await fixture.whenStable();
  });

  it('shows the projected timer rows inside the pill, above the destinations', () => {
    const projected = host().querySelector('[data-testid="projected"]')!;
    const nav = host().querySelector('nav')!;

    expect(pill().contains(projected)).toBe(true);
    expect(pill().contains(nav)).toBe(true);
    expect(projected.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(nav.contains(projected)).toBe(false);
  });

  it('separates the timers from the destinations with a divider and takes the large corner only while timers show', async () => {
    expect(host().querySelector('mat-divider')).toBeNull();
    expect(pill().classList).not.toContain('with-timers');

    fixture.componentInstance.withTimers.set(true);
    await fixture.whenStable();

    const divider = host().querySelector('mat-divider')!;
    expect(divider).not.toBeNull();
    expect(
      host().querySelector('[data-testid="projected"]')!.compareDocumentPosition(divider) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      divider.compareDocumentPosition(host().querySelector('nav')!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(pill().classList).toContain('with-timers');
  });
});
