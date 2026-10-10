import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';

/**
 * The screen of a user in no family (spec 03): an empty state asking to be invited, with no action.
 * Shown by home, History and Trends.
 */
@Component({
  selector: 'nala-no-family',
  imports: [EmptyStateComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './no-family.component.html',
  styles: ':host { display: block; }',
})
export class NoFamilyComponent {}
