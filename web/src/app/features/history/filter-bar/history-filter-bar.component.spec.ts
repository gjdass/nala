import { ComponentFixture, TestBed } from '@angular/core/testing';
import en from '../../../../../public/i18n/en.json';
import { SectionKey } from '../../../core/sections/section.models';
import { translocoTesting } from '../../../testing/transloco-testing';
import { HistoryWindow } from '../history-filters';
import { FilterBarSection, HistoryFilterBarComponent } from './history-filter-bar.component';

describe('HistoryFilterBarComponent', () => {
  let fixture: ComponentFixture<HistoryFilterBarComponent>;
  let windows: HistoryWindow[];
  let selections: SectionKey[][];

  const sections: FilterBarSection[] = [
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
    }).compileComponents();
    fixture = TestBed.createComponent(HistoryFilterBarComponent);
    windows = [];
    selections = [];
    fixture.componentInstance.windowChange.subscribe((w) => windows.push(w));
    fixture.componentInstance.selectedChange.subscribe((s) => selections.push([...s]));
  });

  it('offers 24 h, 7 days and 30 days as a segmented button, the current one checked', async () => {
    await show(['feed'], '7d');

    const group = host().querySelector('mat-button-toggle-group');
    expect(group).not.toBeNull();
    const toggles = [...group!.querySelectorAll('mat-button-toggle')];
    expect(toggles.map((t) => t.textContent?.trim())).toEqual([
      en.history.window['24h'],
      en.history.window['7d'],
      en.history.window['30d'],
    ]);
    expect(toggles.map((t) => t.classList.contains('mat-button-toggle-checked'))).toEqual([
      false,
      true,
      false,
    ]);
  });

  it('emits the window chosen', async () => {
    await show(['feed']);

    host().querySelectorAll<HTMLButtonElement>('mat-button-toggle button')[2].click();
    await fixture.whenStable();

    expect(windows).toEqual(['30d']);
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
