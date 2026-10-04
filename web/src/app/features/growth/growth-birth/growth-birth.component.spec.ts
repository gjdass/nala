import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatListModule } from '@angular/material/list';
import { Baby } from '../../../core/babies/baby.models';
import { translocoTesting } from '../../../testing/transloco-testing';
import { GrowthBirthComponent } from './growth-birth.component';

const baby = (overrides: Partial<Baby> = {}): Baby => ({
  id: 'b1',
  name: 'Tom',
  birthDate: '2026-08-15',
  sex: 'unspecified',
  birthWeightG: 3400,
  birthLengthCm: 50.5,
  birthHeadCircumferenceCm: 35,
  ...overrides,
});

@Component({
  imports: [GrowthBirthComponent, MatListModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<mat-action-list>
    <nala-growth-birth [baby]="baby()" (open)="opened = opened + 1" />
  </mat-action-list>`,
})
class Host {
  readonly baby = signal(baby());
  opened = 0;
}

describe('GrowthBirthComponent', () => {
  let fixture: ComponentFixture<Host>;

  const host = () => fixture.nativeElement as HTMLElement;
  const text = (testId: string) =>
    host().querySelector(`[data-testid="${testId}"]`)?.textContent?.replace(/\s+/g, ' ').trim();

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

  it('shows the measurement icon, the birth date and "Birth"', () => {
    expect(text('entry-icon')).toBe('monitor_weight');
    expect(text('entry-time')).toBe('Aug 15');
    expect(text('entry-label')).toBe('Birth');
  });

  it('shows the birth values as a measurement, empty ones left out', async () => {
    expect(text('entry-summary')).toBe('3.400 kg · 50.5 cm · Head 35.0 cm');

    fixture.componentInstance.baby.set(
      baby({ birthWeightG: null, birthHeadCircumferenceCm: null }),
    );
    await fixture.whenStable();

    expect(text('entry-summary')).toBe('50.5 cm');
  });

  it('emits open when tapped', () => {
    host().querySelector<HTMLButtonElement>('button')!.click();

    expect(fixture.componentInstance.opened).toBe(1);
  });
});
