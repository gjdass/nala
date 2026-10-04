import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatListModule } from '@angular/material/list';
import { TranslocoService } from '@jsverse/transloco';
import { GrowthEntry } from '../../../core/growth-entries/growth-entry.models';
import { aGrowthEntry, aMilestone } from '../../../testing/growth-entries';
import { translocoTesting } from '../../../testing/transloco-testing';
import { GrowthEntryComponent } from './growth-entry.component';

@Component({
  imports: [GrowthEntryComponent, MatListModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<mat-action-list>
    <nala-growth-entry
      [growthEntry]="entry()"
      [birthDate]="birthDate()"
      (open)="opened = opened + 1"
    />
  </mat-action-list>`,
})
class Host {
  readonly entry = signal<GrowthEntry>(aGrowthEntry());
  readonly birthDate = signal<string | null>('2026-08-15');
  opened = 0;
}

describe('GrowthEntryComponent', () => {
  let fixture: ComponentFixture<Host>;

  const host = () => fixture.nativeElement as HTMLElement;
  const text = (testId: string) =>
    host().querySelector(`[data-testid="${testId}"]`)?.textContent?.replace(/\s+/g, ' ').trim();
  const show = async (overrides: Partial<GrowthEntry>) => {
    fixture.componentInstance.entry.set(aGrowthEntry(overrides));
    await fixture.whenStable();
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date(2026, 9, 3, 12, 0));
    await TestBed.configureTestingModule({
      imports: [Host, translocoTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  afterEach(() => vi.useRealTimers());

  it("shows the measurement icon, the entry date and the baby's age on that date", () => {
    expect(text('entry-icon')).toBe('monitor_weight');
    expect(text('entry-time')).toBe('Sep 28');
    expect(text('entry-label')).toBe('6 weeks 2 days');
  });

  it('shows "Today" for a measurement of today, with the age that day', async () => {
    await show({ date: '2026-10-03' });

    expect(text('entry-time')).toBe('Today');
    expect(text('entry-label')).toBe('7 weeks');
  });

  it('shows the age in days, then weeks and days', async () => {
    await show({ date: '2026-08-20' });
    expect(text('entry-label')).toBe('5 days');

    await show({ date: '2026-09-01' });
    expect(text('entry-label')).toBe('2 weeks 3 days');
  });

  it('shows the filled values: weight in kg with 3 decimals, length, head', () => {
    expect(text('entry-summary')).toBe('4.250 kg · 55.5 cm · Head 38.0 cm');
  });

  it('leaves the empty values out', async () => {
    await show({ weightG: null, lengthCm: 56, headCircumferenceCm: null });
    expect(text('entry-summary')).toBe('56.0 cm');

    await show({ weightG: 3990, lengthCm: null, headCircumferenceCm: 37.5 });
    expect(text('entry-summary')).toBe('3.990 kg · Head 37.5 cm');
  });

  it('writes the summary in French, the head circumference as PC', async () => {
    TestBed.inject(TranslocoService).setActiveLang('fr');
    await show({});

    expect(text('entry-summary')).toBe('4,250 kg · 55,5 cm · PC 38,0 cm');
  });

  describe('a milestone', () => {
    const showMilestone = async (overrides: Partial<GrowthEntry> = {}) => {
      fixture.componentInstance.entry.set(aMilestone(overrides));
      await fixture.whenStable();
    };

    it("shows the celebration icon, the date and the baby's age, then the preset's label", async () => {
      await showMilestone();

      expect(text('entry-icon')).toBe('celebration');
      expect(text('entry-time')).toBe('Sep 28');
      expect(text('entry-label')).toBe('6 weeks 2 days');
      expect(text('entry-summary')).toBe('First tooth');
    });

    it("writes the preset's label in French", async () => {
      TestBed.inject(TranslocoService).setActiveLang('fr');
      await showMilestone({ milestone: 'firstSteps' });

      expect(text('entry-summary')).toBe('Premiers pas');
    });

    it('shows the title of a custom milestone', async () => {
      await showMilestone({ milestone: 'custom', title: 'First swim' });

      expect(text('entry-summary')).toBe('First swim');
    });
  });

  it('shows no age without the birth date', async () => {
    fixture.componentInstance.birthDate.set(null);
    await fixture.whenStable();

    expect(host().querySelector('[data-testid="entry-label"]')).toBeNull();
  });

  it('emits open when tapped', () => {
    host().querySelector<HTMLButtonElement>('button')!.click();

    expect(fixture.componentInstance.opened).toBe(1);
  });
});
