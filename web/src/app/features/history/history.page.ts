import { AsyncPipe, NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { map } from 'rxjs';
import { SelectedBabyService } from '../../core/babies/selected-baby.service';
import { onReload } from '../../core/refresh/data-refresh.service';
import { SECTIONS } from '../../core/sections/section.models';
import { LoadComponentPipe } from '../../core/sections/load-component.pipe';
import { sectionScheme } from '../../core/sections/section-scheme';

/**
 * `/history/:section` (spec 04): a top app bar with back, the section's title and the selected baby,
 * then the section's own history list. The route guard only lets built sections in; without a baby,
 * the page goes back home. The babies load again on the reload signal (spec 04 Refresh on return).
 */
@Component({
  selector: 'nala-history',
  imports: [
    AsyncPipe,
    LoadComponentPipe,
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    NgComponentOutlet,
    RouterLink,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './history.page.html',
  styleUrl: './history.page.scss',
  host: { '[class]': 'scheme()' },
})
export class HistoryPage {
  private readonly sections = inject(SECTIONS);
  private readonly key = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('section'))),
  );

  protected readonly store = inject(SelectedBabyService);
  protected readonly section = computed(() => this.sections.find((s) => s.key === this.key()));
  /** The section's colour scheme, for the whole page. */
  protected readonly scheme = computed(() => {
    const section = this.section();
    return section ? sectionScheme(section.key) : '';
  });

  constructor() {
    const router = inject(Router);
    this.store.refresh();
    onReload(() => this.store.refresh());
    effect(() => {
      if (this.store.babies()?.length === 0) {
        void router.navigateByUrl('/');
      }
    });
  }
}
