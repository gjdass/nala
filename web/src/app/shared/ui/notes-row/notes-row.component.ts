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
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
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
 * open from the start when there are notes.
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

  protected readonly open = linkedSignal(() => this.control().value !== '');

  protected reveal(): void {
    this.open.set(true);
    afterNextRender(() => this.textarea()?.nativeElement.focus(), { injector: this.injector });
  }
}
