import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { FormRowComponent } from '../form-row/form-row.component';

/**
 * An on/off field in an entry sheet (spec 04: a switch, e.g. diaper rash): a form row with its label
 * and a trailing switch bound to a boolean control, named by the label. Test id: `name`.
 */
@Component({
  selector: 'nala-switch-row',
  imports: [FormRowComponent, MatSlideToggleModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nala-form-row [label]="label()" [interactive]="false">
      <mat-slide-toggle
        rowTrailing
        [formControl]="control()"
        [aria-label]="label()"
        [attr.data-testid]="name()"
      />
    </nala-form-row>
  `,
  styles: ':host { display: block; }',
})
export class SwitchRowComponent {
  readonly label = input.required<string>();
  /** The switch's test id. */
  readonly name = input.required<string>();
  readonly control = input.required<FormControl<boolean>>();
}
