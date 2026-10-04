import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatListModule } from '@angular/material/list';
import { aDiaper } from '../../../testing/diapers';
import { translocoTesting } from '../../../testing/transloco-testing';
import { DiaperEntryComponent } from './diaper-entry.component';

const shortTime = (d: Date) => new Intl.DateTimeFormat('en', { timeStyle: 'short' }).format(d);

describe('DiaperEntryComponent', () => {
  let fixture: ComponentFixture<DiaperEntryComponent>;

  const find = (testId: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-testid="${testId}"]`);

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 3, 16, 0));
    await TestBed.configureTestingModule({
      imports: [DiaperEntryComponent, MatListModule, translocoTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(DiaperEntryComponent);
  });

  afterEach(() => vi.useRealTimers());

  it('shows the diaper icon, the time and the type, then the notes', async () => {
    const time = new Date(2026, 9, 3, 14, 30);
    fixture.componentRef.setInput(
      'diaper',
      aDiaper({ time: time.toISOString(), wet: true, dirty: true, notes: 'after the bath' }),
    );
    await fixture.whenStable();

    expect(find('entry-icon')?.textContent?.trim()).toBe('baby_changing_station');
    expect(find('entry-time')?.textContent?.trim()).toBe(shortTime(time));
    expect(find('entry-label')?.textContent?.trim()).toBe('Wet + dirty');
    expect(find('entry-summary')?.textContent?.trim()).toBe('after the bath');
  });

  it('shows colour · consistency · Rash as supporting text instead of the notes', async () => {
    fixture.componentRef.setInput(
      'diaper',
      aDiaper({ dirty: true, color: 'green', consistency: 'soft', rash: true, notes: 'n' }),
    );
    await fixture.whenStable();
    expect(find('entry-summary')?.textContent?.trim()).toBe('Green · Soft · Rash');

    fixture.componentRef.setInput('diaper', aDiaper({ dirty: true, consistency: 'hard' }));
    await fixture.whenStable();
    expect(find('entry-summary')?.textContent?.trim()).toBe('Hard');

    fixture.componentRef.setInput('diaper', aDiaper({ rash: true, notes: 'n' }));
    await fixture.whenStable();
    expect(find('entry-summary')?.textContent?.trim()).toBe('Rash');
  });

  it('falls back to the notes when there are no details', async () => {
    fixture.componentRef.setInput('diaper', aDiaper({ notes: 'after the bath' }));
    await fixture.whenStable();
    expect(find('entry-summary')?.textContent?.trim()).toBe('after the bath');

    fixture.componentRef.setInput('diaper', aDiaper());
    await fixture.whenStable();
    expect(find('entry-summary')?.textContent?.trim()).toBe('');
  });

  it('names each type, a diaper with neither toggle being dry', async () => {
    const label = async (wet: boolean, dirty: boolean) => {
      fixture.componentRef.setInput('diaper', aDiaper({ wet, dirty }));
      await fixture.whenStable();
      return find('entry-label')?.textContent?.trim();
    };

    expect(await label(true, false)).toBe('Wet');
    expect(await label(false, true)).toBe('Dirty');
    expect(await label(false, false)).toBe('Dry');
  });

  it('emits open when tapped', async () => {
    fixture.componentRef.setInput('diaper', aDiaper());
    await fixture.whenStable();
    const open = vi.fn();
    fixture.componentInstance.open.subscribe(open);

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button')!.click();

    expect(open).toHaveBeenCalled();
  });
});
