import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { Baby, BabySheetResult } from '../../../core/babies/baby.models';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { SheetService } from '../../../shared/ui/sheet/sheet.service';
import { translocoTesting } from '../../../testing/transloco-testing';
import { BabySheetComponent } from '../baby-sheet/baby-sheet.component';
import { NoBabyComponent } from './no-baby.component';

describe('NoBabyComponent', () => {
  let fixture: ComponentFixture<NoBabyComponent>;
  let sheetClosed: Subject<BabySheetResult | undefined>;
  let sheet: { open: ReturnType<typeof vi.fn> };
  let store: { add: ReturnType<typeof vi.fn> };

  const lea = { id: 'b1', name: 'Lea' } as Baby;
  const host = () => fixture.nativeElement as HTMLElement;
  const text = (testId: string) =>
    host().querySelector(`[data-testid="${testId}"]`)?.textContent?.trim();
  const add = () => host().querySelector<HTMLButtonElement>('[data-testid="add-baby"]')!.click();

  beforeEach(async () => {
    sheetClosed = new Subject();
    sheet = { open: vi.fn(() => sheetClosed) };
    store = { add: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [NoBabyComponent, translocoTesting()],
      providers: [
        { provide: SheetService, useValue: sheet },
        { provide: SelectedBabyService, useValue: store },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(NoBabyComponent);
    await fixture.whenStable();
  });

  it('invites to add a baby', () => {
    expect(text('empty-title')).toBe(en.babies.empty.title);
    expect(text('empty-text')).toBe(en.babies.empty.text);
    expect(text('add-baby')).toBe(en.babies.empty.add);
  });

  it('opens the baby sheet and adds the saved baby', () => {
    add();
    expect(sheet.open).toHaveBeenCalledWith(BabySheetComponent);

    sheetClosed.next({ saved: lea });
    expect(store.add).toHaveBeenCalledWith(lea);
  });

  it('adds nothing when the sheet is closed without saving', () => {
    add();
    sheetClosed.next(undefined);

    expect(store.add).not.toHaveBeenCalled();
  });
});
