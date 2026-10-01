import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import en from '../../../../../public/i18n/en.json';
import { translocoTesting } from '../../../testing/transloco-testing';
import { NOTES_MAX_LENGTH, NotesRowComponent, notesControl } from './notes-row.component';

@Component({
  imports: [NotesRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nala-notes-row [control]="control" />`,
})
class Host {
  control = notesControl();
}

describe('NotesRowComponent', () => {
  let fixture: ComponentFixture<Host>;

  const host = () => fixture.nativeElement as HTMLElement;
  const find = <T extends HTMLElement = HTMLElement>(testId: string) =>
    host().querySelector<T>(`[data-testid="${testId}"]`);
  const textarea = () => find<HTMLTextAreaElement>('notes-input');
  const row = () => host().querySelector<HTMLButtonElement>('button[mat-list-item]')!;

  const render = async (initial = '') => {
    fixture = TestBed.createComponent(Host);
    fixture.componentInstance.control = notesControl(initial);
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Host, translocoTesting()],
    }).compileComponents();
  });

  it('starts closed as "Notes … Add" when empty', async () => {
    await render();

    expect(row().querySelector('[matListItemTitle]')?.textContent?.trim()).toBe(
      en.entrySheet.notes,
    );
    expect(row().querySelector('[matListItemMeta]')?.textContent?.trim()).toBe(en.entrySheet.add);
    expect(textarea()).toBeNull();
  });

  it('opens a text field bound to the control when tapped', async () => {
    await render();

    row().click();
    await fixture.whenStable();

    textarea()!.value = 'Hiccups';
    textarea()!.dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.control.value).toBe('Hiccups');
    expect(row().querySelector('[matListItemMeta]')).toBeNull();
  });

  it('starts open with the notes when there are some', async () => {
    await render('Spat up');

    expect(textarea()?.value).toBe('Spat up');
  });

  it('opens when notes are set later, e.g. an entry loaded once the sheet is open', async () => {
    await render();

    fixture.componentInstance.control.reset('Spat up');
    await fixture.whenStable();

    expect(textarea()?.value).toBe('Spat up');
  });

  it(`refuses more than ${NOTES_MAX_LENGTH} characters, with a field error`, async () => {
    await render('x');
    expect(NOTES_MAX_LENGTH).toBe(1000);

    textarea()!.value = 'x'.repeat(1001);
    textarea()!.dispatchEvent(new Event('input'));
    textarea()!.dispatchEvent(new Event('blur'));
    await fixture.whenStable();

    expect(fixture.componentInstance.control.invalid).toBe(true);
    expect(find('notes-error')?.textContent?.trim()).toBe(en.entrySheet.notesTooLong);
  });

  it('accepts exactly the maximum', () => {
    expect(notesControl('x'.repeat(1000)).valid).toBe(true);
  });
});
