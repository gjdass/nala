import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { SelectedBabyService } from '../../core/babies/selected-baby.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { TopAppBarComponent } from '../../shared/ui/top-app-bar/top-app-bar.component';

const ICONS = { history: 'history', trends: 'insights' } as const;

/**
 * Placeholder for the History and Trends destinations (features 11 and 12): the top bar with the
 * selected baby, then a "Coming soon" empty state. The destination comes from the route data.
 */
@Component({
  selector: 'nala-coming-soon',
  imports: [EmptyStateComponent, TopAppBarComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './coming-soon.page.html',
  styleUrl: './coming-soon.page.scss',
})
export class ComingSoonPage {
  protected readonly destination: keyof typeof ICONS =
    inject(ActivatedRoute).snapshot.data['destination'];

  protected readonly store = inject(SelectedBabyService);
  protected readonly icons = ICONS;

  constructor() {
    this.store.refresh();
  }
}
