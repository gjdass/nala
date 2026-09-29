import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  TypeToConfirmDialogComponent,
  TypeToConfirmDialogData,
} from './type-to-confirm-dialog.component';

describe('TypeToConfirmDialogComponent', () => {
  let fixture: ComponentFixture<TypeToConfirmDialogComponent>;
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  const data: TypeToConfirmDialogData = {
    title: 'Delete Lea?',
    text: 'Everything logged for Lea is deleted too.',
    label: 'Type Lea to confirm',
    expected: 'Lea',
    confirm: 'Delete',
    cancel: 'Cancel',
  };
  const host = () => fixture.nativeElement as HTMLElement;
  const button = (testId: string) =>
    host().querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)!;
  const input = () => host().querySelector<HTMLInputElement>('input[data-testid="typed"]')!;
  const type = async (value: string) => {
    input().value = value;
    input().dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };
    TestBed.configureTestingModule({
      imports: [TypeToConfirmDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });
    fixture = TestBed.createComponent(TypeToConfirmDialogComponent);
    await fixture.whenStable();
  });

  it('shows the title, the text, the field label and both actions', () => {
    expect(host().querySelector('[mat-dialog-title]')?.textContent?.trim()).toBe(data.title);
    expect(host().querySelector('[data-testid="text"]')?.textContent?.trim()).toBe(data.text);
    expect(host().querySelector('mat-label')?.textContent?.trim()).toBe(data.label);
    expect(button('confirm').textContent?.trim()).toBe(data.confirm);
    expect(button('cancel').textContent?.trim()).toBe(data.cancel);
  });

  it('keeps Confirm disabled until the expected text is typed', async () => {
    expect(button('confirm').disabled).toBe(true);

    await type('Le');
    expect(button('confirm').disabled).toBe(true);

    await type('Lea');
    expect(button('confirm').disabled).toBe(false);
  });

  it('ignores surrounding spaces but not case', async () => {
    await type('lea');
    expect(button('confirm').disabled).toBe(true);

    await type('  Lea ');
    expect(button('confirm').disabled).toBe(false);
  });

  it('closes with true on confirm', async () => {
    await type('Lea');
    button('confirm').click();

    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('closes with false on cancel', () => {
    button('cancel').click();

    expect(dialogRef.close).toHaveBeenCalledWith(false);
  });
});
