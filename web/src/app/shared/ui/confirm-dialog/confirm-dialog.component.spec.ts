import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ConfirmDialogComponent, ConfirmDialogData } from './confirm-dialog.component';

describe('ConfirmDialogComponent', () => {
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let host: HTMLElement;

  const data: ConfirmDialogData = {
    title: 'Disable Ben?',
    text: 'Ben will be logged out.',
    confirm: 'Disable',
    cancel: 'Cancel',
  };
  const button = (testId: string) =>
    host.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)!;

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    await fixture.whenStable();
    host = fixture.nativeElement as HTMLElement;
  });

  it('shows the title, the text and both actions', () => {
    expect(host.querySelector('[mat-dialog-title]')?.textContent?.trim()).toBe(data.title);
    expect(host.querySelector('mat-dialog-content')?.textContent?.trim()).toBe(data.text);
    expect(button('confirm').textContent?.trim()).toBe(data.confirm);
    expect(button('cancel').textContent?.trim()).toBe(data.cancel);
  });

  it('closes with true on confirm', () => {
    button('confirm').click();
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('closes with false on cancel', () => {
    button('cancel').click();
    expect(dialogRef.close).toHaveBeenCalledWith(false);
  });
});
