import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { BabiesResult, Baby } from '../../../core/babies/baby.models';
import { BabyService } from '../../../core/babies/baby.service';
import { SheetService } from '../../../shared/ui/sheet/sheet.service';
import { translocoTesting } from '../../../testing/transloco-testing';
import { BabySheetComponent } from '../../babies/baby-sheet/baby-sheet.component';
import { SettingsBabiesComponent } from './settings-babies.component';

describe('SettingsBabiesComponent', () => {
  let fixture: ComponentFixture<SettingsBabiesComponent>;
  let listed: Subject<BabiesResult>;
  let sheetClosed: Subject<Baby | undefined>;
  let sheet: { open: ReturnType<typeof vi.fn> };

  const baby = (id: string, name: string, birthDate: string): Baby => ({
    id,
    name,
    birthDate,
    sex: 'unspecified',
    birthWeightG: null,
    birthLengthCm: null,
    birthHeadCircumferenceCm: null,
  });
  const tom = baby('b1', 'Tom', '2026-05-18');
  const lea = baby('b2', 'Lea', '2026-09-23');

  const host = () => fixture.nativeElement as HTMLElement;
  const items = () => [...host().querySelectorAll<HTMLElement>('[data-testid="baby-item"]')];
  const rows = () =>
    items().map((item) => [
      item.querySelector('[data-testid="baby-name"]')?.textContent?.trim(),
      item.querySelector('[data-testid="baby-age"]')?.textContent?.trim(),
    ]);
  const list = async (result: BabiesResult) => {
    listed.next(result);
    await fixture.whenStable();
  };
  const closeSheet = async (result?: Baby) => {
    sheetClosed.next(result);
    sheetClosed.complete();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 28, 9, 0));
    listed = new Subject<BabiesResult>();
    sheetClosed = new Subject<Baby | undefined>();
    sheet = { open: vi.fn(() => sheetClosed) };
    await TestBed.configureTestingModule({
      imports: [SettingsBabiesComponent, translocoTesting()],
      providers: [
        { provide: BabyService, useValue: { list: vi.fn(() => listed) } },
        { provide: SheetService, useValue: sheet },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SettingsBabiesComponent);
    await fixture.whenStable();
  });

  afterEach(() => vi.useRealTimers());

  it('lists the babies in the API order with their age', async () => {
    await list({ ok: true, babies: [tom, lea] });

    expect(rows()).toEqual([
      ['Tom', '4 months 10 days'],
      ['Lea', '5 days'],
    ]);
  });

  it('shows a load error', async () => {
    await list({ ok: false, errors: { form: 'unknown' } });

    expect(host().querySelector('[data-testid="babies-error"]')?.textContent?.trim()).toBe(
      en.babies.loadError,
    );
  });

  it('adds a baby through the baby sheet', async () => {
    await list({ ok: true, babies: [tom] });

    host().querySelector<HTMLButtonElement>('[data-testid="add-baby"]')!.click();
    expect(sheet.open).toHaveBeenCalledWith(BabySheetComponent);
    await closeSheet(lea);

    expect(rows().map(([name]) => name)).toEqual(['Tom', 'Lea']);
  });

  it('edits a baby through the baby sheet, pre-filled with it', async () => {
    await list({ ok: true, babies: [tom, lea] });

    items()[1].click();
    expect(sheet.open).toHaveBeenCalledWith(BabySheetComponent, lea);
    await closeSheet({ ...lea, name: 'Léa' });

    expect(rows().map(([name]) => name)).toEqual(['Tom', 'Léa']);
  });

  it('keeps the order by birth date after an edit', async () => {
    await list({ ok: true, babies: [tom, lea] });

    items()[1].click();
    await closeSheet({ ...lea, birthDate: '2026-01-10' });

    expect(rows().map(([name]) => name)).toEqual(['Lea', 'Tom']);
  });

  it('changes nothing when the sheet is closed without saving', async () => {
    await list({ ok: true, babies: [tom] });

    items()[0].click();
    await closeSheet();

    expect(rows()).toEqual([['Tom', '4 months 10 days']]);
  });
});
