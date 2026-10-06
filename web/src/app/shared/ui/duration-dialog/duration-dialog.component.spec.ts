import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import en from '../../../../../public/i18n/en.json';
import { translocoTesting } from '../../../testing/transloco-testing';
import { DurationDialogComponent, DurationDialogData } from './duration-dialog.component';

describe('DurationDialogComponent', () => {
  let fixture: ComponentFixture<DurationDialogComponent>;
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  const host = () => fixture.nativeElement as HTMLElement;
  const find = <T extends HTMLElement = HTMLElement>(testId: string) =>
    host().querySelector<T>(`[data-testid="${testId}"]`)!;
  const type = async (part: 'minutes' | 'seconds', value: string) => {
    const input = find<HTMLInputElement>(`duration-${part}`);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
  };

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };
    const data: DurationDialogData = { title: 'Left duration', seconds: 125 };
    await TestBed.configureTestingModule({
      imports: [DurationDialogComponent, translocoTesting()],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DurationDialogComponent);
    await fixture.whenStable();
  });

  it('shows the title and the current duration', () => {
    expect(find('duration-dialog-title').textContent?.trim()).toBe('Left duration');
    expect(find<HTMLInputElement>('duration-minutes').value).toBe('2');
    expect(find<HTMLInputElement>('duration-seconds').value).toBe('5');
    expect(find('duration-dialog-ok').textContent?.trim()).toBe(en.durationDialog.ok);
    expect(find('duration-dialog-cancel').textContent?.trim()).toBe(en.durationDialog.cancel);
  });

  it('leaves room above the fields for their floating labels', () => {
    const field = host().querySelector<HTMLElement>('nala-duration-field')!;

    expect(getComputedStyle(field).paddingTop).toBe('8px');
  });

  it('closes with the typed duration in seconds on OK', async () => {
    await type('minutes', '7');
    await type('seconds', '30');

    find('duration-dialog-ok').click();

    expect(dialogRef.close).toHaveBeenCalledWith(450);
  });

  it('closes without a duration on Cancel', () => {
    find('duration-dialog-cancel').click();

    expect(dialogRef.close).toHaveBeenCalledWith(undefined);
  });

  it('keeps OK disabled while the duration is invalid', async () => {
    await type('seconds', '75');

    expect(find<HTMLButtonElement>('duration-dialog-ok').disabled).toBe(true);
  });
});
