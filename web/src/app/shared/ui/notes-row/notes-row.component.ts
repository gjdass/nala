import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
  Injector,
  input,
  linkedSignal,
  viewChild,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { startWith, switchMap } from 'rxjs';
import { FormRowComponent } from '../form-row/form-row.component';

export const NOTES_MAX_LENGTH = 1000;

/** The control a kind's sheet binds to its notes row. */
export const notesControl = (value = ''): FormControl<string> =>
  new FormControl(value, {
    nonNullable: true,
    validators: Validators.maxLength(NOTES_MAX_LENGTH),
  });

/**
 * The Notes row of every entry sheet: "Notes … Add" until tapped, then a multi-line text field;
 * open as soon as there are notes (from the start, or once an entry is loaded into the sheet).
 */
@Component({
  selector: 'nala-notes-row',
  imports: [
    CdkTextareaAutosize,
    FormRowComponent,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notes-row.component.html',
  styleUrl: './notes-row.component.scss',
})
export class NotesRowComponent {
  private readonly injector = inject(Injector);
  private readonly textarea = viewChild<ElementRef<HTMLTextAreaElement>>('textarea');

  readonly control = input.required<FormControl<string>>();

  private readonly notes = toSignal(
    toObservable(this.control).pipe(
      switchMap((control) => control.valueChanges.pipe(startWith(control.value))),
    ),
    { initialValue: '' },
  );
  /** Never closes by itself: clearing the text keeps the field open. */
  protected readonly open = linkedSignal<string, boolean>({
    source: this.notes,
    computation: (notes, previous) => (previous?.value ?? false) || notes !== '',
  });

  protected reveal(): void {
    this.open.set(true);
    afterNextRender(() => this.textarea()?.nativeElement.focus(), { injector: this.injector });
  }
}
