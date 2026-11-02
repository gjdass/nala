import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import en from '../../../../../public/i18n/en.json';
import { SectionKey } from '../../../core/sections/section.models';
import { translocoTesting } from '../../../testing/transloco-testing';
import { HistoryWindow } from '../history-filters';
import { MenuSection } from '../../../core/sections/section-menu';
import { HistoryFilterBarComponent } from './history-filter-bar.component';

describe('HistoryFilterBarComponent', () => {
  let fixture: ComponentFixture<HistoryFilterBarComponent>;
  let windows: HistoryWindow[];
  let selections: SectionKey[][];

  const sections: MenuSection[] = [
    { key: 'diaper', icon: 'baby_changing_station', visible: true },
    { key: 'feed', icon: 'restaurant', visible: true },
    { key: 'sleep', icon: 'bedtime', visible: false },
    { key: 'pump', icon: 'water_drop', visible: false },
  ];

  const host = () => fixture.nativeElement as HTMLElement;
  const find = (testId: string) => document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const menuRows = () => [
    ...document.querySelectorAll<HTMLButtonElement>('[data-testid="section-option"]'),
  ];
  const show = async (selected: SectionKey[], window: HistoryWindow = '24h', list = sections) => {
    fixture.componentRef.setInput('window', window);
    fixture.componentRef.setInput('selected', selected);
    fixture.componentRef.setInput('sections', list);
    await fixture.whenStable();
  };
  const openMenu = async () => {
    find('sections-chip')!.click();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoryFilterBarComponent, translocoTesting()],
      providers: [provideNativeDateAdapter()],
    }).compileComponents();
    fixture = TestBed.createComponent(HistoryFilterBarComponent);
    windows = [];
    selections = [];
    fixture.componentInstance.windowChange.subscribe((w) => windows.push(w));
    fixture.componentInstance.selectedChange.subscribe((s) => selections.push([...s]));
  });

  const windowRows = () => [
    ...document.querySelectorAll<HTMLButtonElement>('[data-testid="window-option"]'),
  ];
  const openWindowMenu = async () => {
    find('window-chip')!.click();
    await fixture.whenStable();
  };

  it('shows the window chip first, then the sections chip, in one chip set', async () => {
    await show(['feed']);

    const sets = host().querySelectorAll('mat-chip-set');
    expect(sets.length).toBe(1);
    const chips = [...sets[0].querySelectorAll('mat-chip')];
    expect(chips.map((c) => c.getAttribute('data-testid'))).toEqual([
      'window-chip',
      'sections-chip',
    ]);
    expect(host().querySelector('mat-button-toggle-group')).toBeNull();
  });

  it('shows the current window on its chip', async () => {
    await show(['feed'], '7d');

    expect(find('window-chip')!.textContent).toContain(en.history.window['7d']);
  });

  it('reads Custom on its chip with a custom window, and shows the date range field with its dates', async () => {
    fixture.componentRef.setInput('range', { start: '2026-08-04', end: '2026-11-02' });
    await show(['feed'], 'custom');

    expect(find('window-chip')!.textContent).toContain(en.history.window.custom);
    const field = host().querySelector('nala-date-range-field');
    expect(field).not.toBeNull();
    expect(
      field!.compareDocumentPosition(host().querySelector('mat-chip-set')!) &
        Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy();
    expect(new Date((find('range-start') as HTMLInputElement).value)).toEqual(new Date(2026, 7, 4));
    expect(new Date((find('range-end') as HTMLInputElement).value)).toEqual(new Date(2026, 10, 2));
  });

  it('shows no date range field with a rolling window', async () => {
    fixture.componentRef.setInput('range', { start: '2026-08-04', end: '2026-11-02' });
    await show(['feed'], '30d');

    expect(host().querySelector('nala-date-range-field')).toBeNull();
  });

  it('emits the dates picked as local calendar dates', async () => {
    const ranges: unknown[] = [];
    fixture.componentInstance.rangeChange.subscribe((r) => ranges.push(r));
    fixture.componentRef.setInput('range', { start: '2026-08-04', end: '2026-11-02' });
    await show(['feed'], 'custom');

    const start = find('range-start') as HTMLInputElement;
    start.value = '9/1/2026';
    start.dispatchEvent(new Event('input'));
    start.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(ranges).toEqual([{ start: '2026-09-01', end: '2026-11-02' }]);
  });

  it('lists the three windows, then Custom after a divider, the current one checked', async () => {
    await show(['feed'], '7d');
    await openWindowMenu();

    expect(
      windowRows().map((row) => [
        row.getAttribute('role'),
        row.textContent?.trim(),
        row.getAttribute('aria-checked'),
        !!row.querySelector('mat-pseudo-checkbox.mat-pseudo-checkbox-checked'),
      ]),
    ).toEqual([
      ['menuitemradio', en.history.window['24h'], 'false', false],
      ['menuitemradio', en.history.window['7d'], 'true', true],
      ['menuitemradio', en.history.window['30d'], 'false', false],
      ['menuitemradio', en.history.window.custom, 'false', false],
    ]);
    const panel = document.querySelector('.mat-mdc-menu-panel')!;
    expect(
      [...panel.querySelectorAll('[data-testid="window-option"], mat-divider')].map((e) =>
        e.tagName.toLowerCase(),
      ),
    ).toEqual(['button', 'button', 'button', 'mat-divider', 'button']);
  });

  it('emits the window picked and closes the menu', async () => {
    await show(['feed']);
    await openWindowMenu();

    expect(find('window-chip')!.getAttribute('aria-expanded')).toBe('true');
    windowRows()[2].click();
    await fixture.whenStable();

    expect(windows).toEqual(['30d']);
    expect(find('window-chip')!.getAttribute('aria-expanded')).toBe('false');
  });

  it('shows how many sections are selected on the chip', async () => {
    await show(['feed', 'sleep', 'diaper']);

    expect(host().querySelector('mat-chip-set [data-testid="sections-chip"]')).not.toBeNull();
    expect(find('sections-chip')!.textContent).toContain('Sections · 3');
  });

  it('lists the visible sections in order, a divider, then the hidden ones, each with its icon, title and checkbox', async () => {
    await show(['feed', 'pump']);
    await openMenu();

    expect(
      menuRows().map((row) => [
        row.querySelector('mat-icon')?.textContent?.trim(),
        row.querySelector('[data-testid="section-title"]')?.textContent?.trim(),
        row.getAttribute('aria-checked'),
        !!row.querySelector('mat-pseudo-checkbox.mat-pseudo-checkbox-checked'),
      ]),
    ).toEqual([
      ['baby_changing_station', en.sections.diaper, 'false', false],
      ['restaurant', en.sections.feed, 'true', true],
      ['bedtime', en.sections.sleep, 'false', false],
      ['water_drop', en.sections.pump, 'true', true],
    ]);
    const panel = document.querySelector('.mat-mdc-menu-panel')!;
    const children = [...panel.querySelectorAll('[data-testid="section-option"], mat-divider')];
    expect(children.map((e) => e.tagName.toLowerCase())).toEqual([
      'button',
      'button',
      'mat-divider',
      'button',
      'button',
    ]);
  });

  it('has no divider when no section is hidden', async () => {
    await show(
      ['feed'],
      '24h',
      sections.map((s) => ({ ...s, visible: true })),
    );
    await openMenu();

    expect(document.querySelector('.mat-mdc-menu-panel mat-divider')).toBeNull();
  });

  it('selects and unselects a section at once, keeping the menu open', async () => {
    await show(['feed', 'pump']);
    await openMenu();

    menuRows()[0].click();
    await fixture.whenStable();
    expect(selections.at(-1)).toEqual(['diaper', 'feed', 'pump']);
    expect(document.querySelector('.mat-mdc-menu-panel')).not.toBeNull();

    menuRows()[3].click();
    await fixture.whenStable();
    expect(selections.at(-1)).toEqual(['feed']);
    expect(document.querySelector('.mat-mdc-menu-panel')).not.toBeNull();
  });

  it("can't unselect the last selected section", async () => {
    await show(['sleep']);
    await openMenu();

    const rows = menuRows();
    expect(rows.map((r) => r.disabled)).toEqual([false, false, true, false]);
    rows[2].click();
    await fixture.whenStable();
    expect(selections).toEqual([]);
  });
});
