import { ComponentFixture, TestBed } from '@angular/core/testing';
import en from '../../../../../public/i18n/en.json';
import { translocoTesting } from '../../../testing/transloco-testing';
import { MenuSection } from '../../../core/sections/section-menu';
import { TrendsRange } from '../trends-period';
import { TrendsFilterBarComponent } from './trends-filter-bar.component';

describe('TrendsFilterBarComponent', () => {
  let fixture: ComponentFixture<TrendsFilterBarComponent>;
  let events: unknown[][];

  const sections: MenuSection[] = [
    { key: 'diaper', icon: 'baby_changing_station', visible: true },
    { key: 'feed', icon: 'restaurant', visible: true },
    { key: 'sleep', icon: 'bedtime', visible: false },
  ];
  const host = () => fixture.nativeElement as HTMLElement;
  const find = (testId: string) => document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const all = (testId: string) => [
    ...document.querySelectorAll<HTMLButtonElement>(`[data-testid="${testId}"]`),
  ];
  const show = async (inputs: Record<string, unknown> = {}) => {
    const values = {
      section: 'feed',
      range: '7d' as TrendsRange,
      sections,
      label: 'Oct 3 – 9',
      canGoBack: true,
      canGoForward: true,
      navigable: true,
      ...inputs,
    };
    for (const [name, value] of Object.entries(values)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrendsFilterBarComponent, translocoTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(TrendsFilterBarComponent);
    events = [];
    const c = fixture.componentInstance;
    c.sectionChange.subscribe((v) => events.push(['section', v]));
    c.rangeChange.subscribe((v) => events.push(['range', v]));
    c.previous.subscribe(() => events.push(['previous']));
    c.next.subscribe(() => events.push(['next']));
  });

  it('shows the section chip then the range chip in one chip set, each with its value', async () => {
    await show({ range: '3m' });

    const sets = host().querySelectorAll('mat-chip-set');
    expect(sets.length).toBe(1);
    const chips = [...sets[0].querySelectorAll('mat-chip')];
    expect(chips.map((c) => c.getAttribute('data-testid'))).toEqual(['section-chip', 'range-chip']);
    expect(chips[0].textContent).toContain(en.sections.feed);
    expect(chips[1].textContent).toContain(en.trends.range['3m']);
  });

  it('lists the sections with icon and title, visible ones, a divider, then hidden ones, the current checked', async () => {
    await show();
    find('section-chip')!.click();
    await fixture.whenStable();

    expect(
      all('section-option').map((row) => [
        row.querySelector('mat-icon')?.textContent?.trim(),
        row.textContent?.replace(row.querySelector('mat-icon')?.textContent ?? '', '').trim(),
        row.getAttribute('aria-checked'),
      ]),
    ).toEqual([
      ['baby_changing_station', en.sections.diaper, 'false'],
      ['restaurant', en.sections.feed, 'true'],
      ['bedtime', en.sections.sleep, 'false'],
    ]);
    const panel = document.querySelector('.mat-mdc-menu-panel')!;
    expect(
      [...panel.querySelectorAll('[data-testid="section-option"], mat-divider')].map((e) =>
        e.tagName.toLowerCase(),
      ),
    ).toEqual(['button', 'button', 'mat-divider', 'button']);
  });

  it('emits the section picked', async () => {
    await show();
    find('section-chip')!.click();
    await fixture.whenStable();
    all('section-option')[2].click();
    await fixture.whenStable();

    expect(events).toEqual([['section', 'sleep']]);
  });

  it('lists the 5 ranges, the current one checked, and emits the one picked', async () => {
    await show({ range: '30d' });
    find('range-chip')!.click();
    await fixture.whenStable();

    expect(
      all('range-option').map((r) => [r.textContent?.trim(), r.getAttribute('aria-checked')]),
    ).toEqual([
      [en.trends.range['7d'], 'false'],
      [en.trends.range['30d'], 'true'],
      [en.trends.range['3m'], 'false'],
      [en.trends.range['6m'], 'false'],
      [en.trends.range.birth, 'false'],
    ]);
    all('range-option')[4].click();
    await fixture.whenStable();

    expect(events).toEqual([['range', 'birth']]);
  });

  it('shows the label between labelled previous and next buttons that emit and can be disabled', async () => {
    await show({ canGoForward: false });

    const previous = host().querySelector<HTMLButtonElement>('[data-testid="previous"]')!;
    const next = host().querySelector<HTMLButtonElement>('[data-testid="next"]')!;
    expect(previous.getAttribute('aria-label')).toBe(en.trends.previous);
    expect(next.getAttribute('aria-label')).toBe(en.trends.next);
    expect(host().querySelector('[data-testid="period-label"]')!.textContent?.trim()).toBe(
      'Oct 3 – 9',
    );
    expect(next.disabled).toBe(true);
    expect(previous.disabled).toBe(false);

    previous.click();
    expect(events).toEqual([['previous']]);

    await show({ canGoForward: true, canGoBack: false });
    expect(previous.disabled).toBe(true);
    next.click();
    expect(events).toEqual([['previous'], ['next']]);
  });

  it('shows the label without arrows when not navigable', async () => {
    await show({ navigable: false, label: 'Aug 2025 – Oct 2026' });

    expect(host().querySelector('[data-testid="previous"]')).toBeNull();
    expect(host().querySelector('[data-testid="next"]')).toBeNull();
    expect(host().querySelector('[data-testid="period-label"]')!.textContent?.trim()).toBe(
      'Aug 2025 – Oct 2026',
    );
  });
});
