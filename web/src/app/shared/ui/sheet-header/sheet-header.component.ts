import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { TranslocoPipe } from '@jsverse/transloco';
import { SectionKey } from '../../../core/sections/section.models';

/**
 * The header of a form sheet, laid out like an M3 top app bar: close, title, Save; in the colour of
 * `section` when given one.
 */
@Component({
  selector: 'nala-sheet-header',
  imports: [MatButtonModule, MatIconModule, MatToolbarModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sheet-header.component.html',
  styleUrl: './sheet-header.component.scss',
})
export class SheetHeaderComponent {
  readonly title = input.required<string>();
  readonly saveDisabled = input(false);
  readonly section = input<SectionKey | null>(null);
  readonly closed = output();
  readonly saved = output();
}
