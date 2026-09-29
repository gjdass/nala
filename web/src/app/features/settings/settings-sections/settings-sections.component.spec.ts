import { CdkDropList } from '@angular/cdk/drag-drop';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { By } from '@angular/platform-browser';
import { Subject } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import {
  SECTIONS,
  SectionDefinition,
  SectionPreference,
  SectionsSaveResult,
} from '../../../core/sections/section.models';
import { SectionPreferencesService } from '../../../core/sections/section-preferences.service';
import { translocoTesting } from '../../../testing/transloco-testing';
import { SettingsSectionsComponent } from './settings-sections.component';

describe('SettingsSectionsComponent', () => {
  let fixture: ComponentFixture<SettingsSectionsComponent>;
  let saved: Subject<SectionsSaveResult>;
  let store: {
    preferences: ReturnType<typeof signal<SectionPreference[] | null>>;
    load: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let snackBar: { open: ReturnType<typeof vi.fn> };

  /** Three of the six sections are built; the others must keep their place when saving. */
  const registered: SectionDefinition[] = [
    { key: 'feed', icon: 'restaurant' },
    { key: 'diaper', icon: 'baby_changing_station' },
    { key: 'growth', icon: 'straighten' },
  ];
  const userOrder: SectionPreference[] = [
    { key: 'sleep', visible: true },
    { key: 'growth', visible: true },
    { key: 'pump', visible: false },
    { key: 'feed', visible: true },
    { key: 'medication', visible: true },
    { key: 'diaper', visible: false },
  ];

  const host = () => fixture.nativeElement as HTMLElement;
  const rows = () => [...host().querySelectorAll<HTMLElement>('[data-testid^="section-"]')];
  const row = (key: string) => host().querySelector<HTMLElement>(`[data-testid="section-${key}"]`)!;
  const switchOf = (key: string) =>
    row(key).querySelector<HTMLButtonElement>('button[role="switch"]')!;
  const settle = () => fixture.whenStable();

  const render = async (sections: SectionDefinition[] = registered) => {
    TestBed.overrideProvider(SECTIONS, { useValue: sections });
    fixture = TestBed.createComponent(SettingsSectionsComponent);
    await settle();
  };

  const drop = async (previousIndex: number, currentIndex: number) => {
    fixture.debugElement
      .query(By.directive(CdkDropList))
      .triggerEventHandler('cdkDropListDropped', { previousIndex, currentIndex });
    await settle();
  };

  beforeEach(async () => {
    saved = new Subject<SectionsSaveResult>();
    store = {
      preferences: signal<SectionPreference[] | null>(userOrder),
      load: vi.fn(),
      save: vi.fn(() => saved),
    };
    snackBar = { open: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [SettingsSectionsComponent, translocoTesting()],
      providers: [
        { provide: SectionPreferencesService, useValue: store },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    }).compileComponents();
  });

  it("loads the user's preferences", async () => {
    await render();
    expect(store.load).toHaveBeenCalled();
  });

  it("lists only the built sections, in the user's order, with a drag handle and a switch", async () => {
    await render();

    expect(rows().map((r) => r.dataset['testid'])).toEqual([
      'section-growth',
      'section-feed',
      'section-diaper',
    ]);
    expect(row('feed').textContent).toContain(en.sections.feed);
    expect(row('feed').querySelector('[cdkDragHandle]')?.getAttribute('aria-label')).toBe(
      en.settings.sections.dragHandle,
    );
    expect(switchOf('feed').getAttribute('aria-checked')).toBe('true');
    expect(switchOf('diaper').getAttribute('aria-checked')).toBe('false');
  });

  it('saves the new order when a row is dropped, keeping the other sections in their places', async () => {
    await render();

    await drop(0, 2); // growth moves below diaper

    expect(store.save).toHaveBeenCalledWith([
      { key: 'sleep', visible: true },
      { key: 'feed', visible: true },
      { key: 'pump', visible: false },
      { key: 'diaper', visible: false },
      { key: 'medication', visible: true },
      { key: 'growth', visible: true },
    ]);
  });

  it('saves nothing when a row is dropped where it was', async () => {
    await render();

    await drop(1, 1);

    expect(store.save).not.toHaveBeenCalled();
  });

  it('hides a section with its switch', async () => {
    await render();

    switchOf('feed').click();
    await settle();

    expect(store.save).toHaveBeenCalledWith(
      userOrder.map((p) => (p.key === 'feed' ? { ...p, visible: false } : p)),
    );
  });

  it('shows a hidden section with its switch', async () => {
    await render();

    switchOf('diaper').click();
    await settle();

    expect(store.save).toHaveBeenCalledWith(
      userOrder.map((p) => (p.key === 'diaper' ? { ...p, visible: true } : p)),
    );
  });

  it('keeps at least one built section visible: its switch is disabled', async () => {
    store.preferences.set(
      userOrder.map((p) => (p.key === 'growth' ? { ...p, visible: false } : p)),
    );
    await render();

    expect(switchOf('feed').disabled).toBe(true);
    expect(switchOf('growth').disabled).toBe(false);
    expect(switchOf('diaper').disabled).toBe(false);
  });

  it('says so when saving fails', async () => {
    await render();
    switchOf('feed').click();
    await settle();

    saved.next({ ok: false, errors: { form: 'unknown' } });
    await settle();

    expect(snackBar.open).toHaveBeenCalledWith(en.settings.sections.saveFailed, undefined, {
      duration: 3000,
    });
  });

  it('shows nothing until the preferences are loaded', async () => {
    store.preferences.set(null);
    await render();

    expect(rows()).toEqual([]);
  });
});
