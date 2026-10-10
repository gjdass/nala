import { AsyncPipe, NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { SelectedBabyService } from '../../core/babies/selected-baby.service';
import { onReload } from '../../core/refresh/data-refresh.service';
import { SECTIONS, SectionDefinition } from '../../core/sections/section.models';
import { SectionPreferencesService } from '../../core/sections/section-preferences.service';
import { TopAppBarComponent } from '../../shared/ui/top-app-bar/top-app-bar.component';
import { NoBabyComponent } from '../babies/no-baby/no-baby.component';
import { LoadComponentPipe } from '../../core/sections/load-component.pipe';

/**
 * The top bar with the selected baby, then one card per visible built section in the user's order;
 * until the family has a baby, only the invitation to add one. The babies and the section preferences
 * load again on the reload signal (spec 04 Refresh on return).
 */
@Component({
  selector: 'nala-home',
  imports: [
    AsyncPipe,
    LoadComponentPipe,
    NgComponentOutlet,
    NoBabyComponent,
    TopAppBarComponent,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {
  private readonly preferences = inject(SectionPreferencesService);
  private readonly registry = new Map(inject(SECTIONS).map((s) => [s.key, s]));

  protected readonly store = inject(SelectedBabyService);

  /** The visible built sections, in the user's order; none until the preferences are loaded. */
  protected readonly sections = computed(() =>
    (this.preferences.preferences() ?? [])
      .filter((p) => p.visible)
      .map((p) => this.registry.get(p.key))
      .filter((s): s is SectionDefinition => s !== undefined),
  );

  constructor() {
    const load = () => {
      this.store.refresh();
      this.preferences.load();
    };
    load();
    onReload(load);
  }
}
