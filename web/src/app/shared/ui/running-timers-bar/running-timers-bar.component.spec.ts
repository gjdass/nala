import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { Baby } from '../../../core/babies/baby.models';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { SECTIONS } from '../../../core/sections/section.models';
import { NowService } from '../../../core/time/now.service';
import { RUNNING_TIMER_SOURCES } from '../../../core/timers/running-timer.models';
import { fakeSection } from '../../../testing/fake-section';
import { fakeTimer, fakeTimerSource } from '../../../testing/fake-timer-source';
import { translocoTesting } from '../../../testing/transloco-testing';
import { EntrySheetService } from '../entry-sheet/entry-sheet.service';
import { RunningTimersBarComponent } from './running-timers-bar.component';

const baby = (id: string, name: string): Baby => ({
  id,
  name,
  birthDate: '2026-01-01',
  sex: 'unspecified',
  birthWeightG: null,
  birthLengthCm: null,
  birthHeadCircumferenceCm: null,
});

describe('RunningTimersBarComponent', () => {
  let fixture: ComponentFixture<RunningTimersBarComponent>;
  let fake: ReturnType<typeof fakeTimerSource>;
  let now: ReturnType<typeof signal<number>>;
  let babies: ReturnType<typeof signal<Baby[] | null>>;
  let entrySheets: { edit: ReturnType<typeof vi.fn> };

  const host = () => fixture.nativeElement as HTMLElement;
  const rows = () => [...host().querySelectorAll<HTMLButtonElement>('[data-testid="timer-row"]')];
  const render = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };

  // 12m 4s after the timers start.
  const startedAt = 1_000_000;
  const at = startedAt + (12 * 60 + 4) * 1000;

  beforeEach(async () => {
    fake = fakeTimerSource();
    now = signal(at);
    babies = signal<Baby[] | null>([baby('baby-1', 'Emma')]);
    entrySheets = { edit: vi.fn(() => of(undefined)) };
    await TestBed.configureTestingModule({
      imports: [RunningTimersBarComponent, translocoTesting()],
      providers: [
        { provide: RUNNING_TIMER_SOURCES, useValue: [fake.source] },
        { provide: SECTIONS, useValue: [fakeSection('feed', 'restaurant'), fakeSection('sleep', 'bedtime')] },
        { provide: NowService, useValue: { now } },
        { provide: SelectedBabyService, useValue: { babies } },
        { provide: EntrySheetService, useValue: entrySheets },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(RunningTimersBarComponent);
    await render();
  });

  it('renders nothing when no timer runs', () => {
    expect(host().children.length).toBe(0);
  });

  it('appears when a timer starts and disappears when it stops', async () => {
    fake.set([fakeTimer({ startedAt })]);
    await render();
    expect(rows().length).toBe(1);

    fake.set([]);
    await render();
    expect(host().children.length).toBe(0);
  });

  it('shows one row per running timer with section icon, label and duration', async () => {
    fake.set([
      fakeTimer({ id: 'a', startedAt }),
      fakeTimer({ id: 'b', section: 'sleep', label: 'sections.sleep', startedAt: startedAt + 4000 }),
    ]);
    await render();

    expect(rows().length).toBe(2);
    expect(rows()[0].querySelector('[data-testid="timer-icon"]')?.textContent?.trim()).toBe('restaurant');
    expect(rows()[0].querySelector('[data-testid="timer-label"]')?.textContent?.trim()).toBe(en.sections.feed);
    expect(rows()[0].querySelector('[data-testid="timer-duration"]')?.textContent?.trim()).toBe('12m 4s');
    expect(rows()[1].querySelector('[data-testid="timer-icon"]')?.textContent?.trim()).toBe('bedtime');
    expect(rows()[1].querySelector('[data-testid="timer-label"]')?.textContent?.trim()).toBe(en.sections.sleep);
    expect(rows()[1].querySelector('[data-testid="timer-duration"]')?.textContent?.trim()).toBe('12m');
  });

  it('updates the duration live', async () => {
    fake.set([fakeTimer({ startedAt })]);
    await render();

    now.set(at + 60_000);
    await render();

    expect(rows()[0].querySelector('[data-testid="timer-duration"]')?.textContent?.trim()).toBe('13m 4s');
  });

  it("hides the baby's name with a single baby", async () => {
    fake.set([fakeTimer({ startedAt })]);
    await render();

    expect(host().querySelector('[data-testid="timer-baby"]')).toBeNull();
  });

  it("shows each timer's baby name, for every baby, with several babies", async () => {
    babies.set([baby('baby-1', 'Emma'), baby('baby-2', 'Léo')]);
    fake.set([
      fakeTimer({ id: 'a', babyId: 'baby-2', startedAt }),
      fakeTimer({ id: 'b', babyId: 'baby-1', startedAt }),
    ]);
    await render();

    expect(rows().map((r) => r.querySelector('[data-testid="timer-baby"]')?.textContent?.trim())).toEqual([
      'Léo',
      'Emma',
    ]);
  });

  it("opens the timer's entry sheet on tap", async () => {
    const entry = { id: 'feed-1' };
    fake.set([fakeTimer({ section: 'feed', kind: 'breastfeed', entry, startedAt })]);
    await render();

    rows()[0].click();

    expect(entrySheets.edit).toHaveBeenCalledWith('feed', 'breastfeed', entry);
  });

  it('uses default-density Material list items, labelled for assistive technology', async () => {
    fake.set([fakeTimer({ startedAt })]);
    await render();

    const list = host().querySelector('mat-action-list');
    expect(list?.getAttribute('aria-label')).toBe(en.timers.bar);
    expect(rows().every((r) => r.hasAttribute('mat-list-item') && list?.contains(r))).toBe(true);
    expect(host().querySelector('[class*="density"]')).toBeNull();
  });
});
