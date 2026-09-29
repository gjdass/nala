import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import en from '../../../../../public/i18n/en.json';
import { fakeKind } from '../../../testing/fake-section';
import { translocoTesting } from '../../../testing/transloco-testing';
import { KindPickerComponent, KindPickerData } from './kind-picker.component';

describe('KindPickerComponent', () => {
  let fixture: ComponentFixture<KindPickerComponent>;
  let sheetRef: { dismiss: ReturnType<typeof vi.fn> };

  const bottle = fakeKind('bottle', 'water_full', 'sections.feed');
  const solids = fakeKind('solids', 'restaurant', 'sections.diaper');
  const data: KindPickerData = { kinds: [bottle, solids] };

  const host = () => fixture.nativeElement as HTMLElement;
  const items = () => [...host().querySelectorAll<HTMLButtonElement>('[data-testid^="kind-"]')];

  beforeEach(async () => {
    sheetRef = { dismiss: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [KindPickerComponent, translocoTesting()],
      providers: [
        { provide: MAT_BOTTOM_SHEET_DATA, useValue: data },
        { provide: MatBottomSheetRef, useValue: sheetRef },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(KindPickerComponent);
    await fixture.whenStable();
  });

  it('lists every kind as a list item with its icon and translated label', () => {
    expect(items().map((i) => i.getAttribute('data-testid'))).toEqual([
      'kind-bottle',
      'kind-solids',
    ]);
    expect(items().every((i) => i.hasAttribute('mat-list-item'))).toBe(true);
    expect(items()[0].querySelector('mat-icon')?.textContent?.trim()).toBe('water_full');
    expect(items()[0].textContent).toContain(en.sections.feed);
    expect(items()[1].textContent).toContain(en.sections.diaper);
  });

  it('is labelled for assistive technology', () => {
    expect(host().querySelector('mat-action-list')?.getAttribute('aria-label')).toBe(
      en.kindPicker.label,
    );
  });

  it('dismisses with the kind tapped', () => {
    items()[1].click();

    expect(sheetRef.dismiss).toHaveBeenCalledWith(solids);
  });
});
