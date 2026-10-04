import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatListModule } from '@angular/material/list';
import { TranslocoService } from '@jsverse/transloco';
import { aMedication } from '../../../testing/medications';
import { translocoTesting } from '../../../testing/transloco-testing';
import { MedicationEntryComponent } from './medication-entry.component';

const shortTime = (d: Date) => new Intl.DateTimeFormat('en', { timeStyle: 'short' }).format(d);

describe('MedicationEntryComponent', () => {
  let fixture: ComponentFixture<MedicationEntryComponent>;

  const find = (testId: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const summary = async (overrides: Parameters<typeof aMedication>[0]) => {
    fixture.componentRef.setInput('medication', aMedication(overrides));
    await fixture.whenStable();
    return find('entry-summary')?.textContent?.trim();
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 3, 16, 0));
    await TestBed.configureTestingModule({
      imports: [MedicationEntryComponent, MatListModule, translocoTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(MedicationEntryComponent);
  });

  afterEach(() => vi.useRealTimers());

  it('shows the medication icon, the time and the name, then the dose and the notes', async () => {
    const time = new Date(2026, 9, 3, 14, 30);
    fixture.componentRef.setInput(
      'medication',
      aMedication({ time: time.toISOString(), name: 'Paracetamol', notes: 'fever' }),
    );
    await fixture.whenStable();

    expect(find('entry-icon')?.textContent?.trim()).toBe('medication');
    expect(find('entry-time')?.textContent?.trim()).toBe(shortTime(time));
    expect(find('entry-label')?.textContent?.trim()).toBe('Paracetamol');
    expect(find('entry-summary')?.textContent?.trim()).toBe('2.5 ml · fever');
  });

  it('shows whichever of the dose and the notes exists', async () => {
    expect(await summary({ amount: 10, unit: 'drops', notes: null })).toBe('10 drops');
    expect(await summary({ amount: null, unit: null, notes: 'with food' })).toBe('with food');
    expect(await summary({ amount: null, unit: null, notes: null })).toBe('');
  });

  it('writes the dose in the active language', async () => {
    TestBed.inject(TranslocoService).setActiveLang('fr');

    expect(await summary({ amount: 2.5, unit: 'ml' })).toBe('2,5 ml');
  });

  it('emits open when tapped', async () => {
    fixture.componentRef.setInput('medication', aMedication());
    await fixture.whenStable();
    const open = vi.fn();
    fixture.componentInstance.open.subscribe(open);

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button')!.click();

    expect(open).toHaveBeenCalled();
  });
});
