import { ChangeDetectionStrategy, Component } from '@angular/core';
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

  it('lists Dashboard, History, Trends and Settings in that order, with an icon and a label', () => {
    expect(
      items().map((a) => [
        a.getAttribute('href'),
        a.querySelector('mat-icon')?.textContent?.trim(),
        a.querySelector('[data-testid="nav-label"]')?.textContent?.trim(),
      ]),
    ).toEqual([
      ['/', 'dashboard', en.nav.dashboard],
      ['/history', 'history', en.nav.history],
      ['/trends', 'insights', en.nav.trends],
      ['/settings', 'settings', en.nav.settings],
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
