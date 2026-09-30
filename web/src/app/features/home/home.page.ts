import { AsyncPipe, NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoPipe } from '@jsverse/transloco';
import { BabySheetResult } from '../../core/babies/baby.models';
import { SelectedBabyService } from '../../core/babies/selected-baby.service';
import { SECTIONS, SectionDefinition } from '../../core/sections/section.models';
import { SectionPreferencesService } from '../../core/sections/section-preferences.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { SheetService } from '../../shared/ui/sheet/sheet.service';
import { TopAppBarComponent } from '../../shared/ui/top-app-bar/top-app-bar.component';
import { BabySheetComponent } from '../babies/baby-sheet/baby-sheet.component';
import { LoadComponentPipe } from '../../core/sections/load-component.pipe';

/**
 * The top bar with the selected baby, then one card per visible built section in the user's order;
 * until the family has a baby, only the invitation to add one.
 */
@Component({
  selector: 'nala-home',
  imports: [
    AsyncPipe,
    LoadComponentPipe,
    EmptyStateComponent,
    MatButtonModule,
    NgComponentOutlet,
    TopAppBarComponent,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {
  private readonly sheet = inject(SheetService);
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
    this.store.refresh();
    this.preferences.load();
  }

  protected addBaby(): void {
    this.sheet.open<BabySheetComponent, BabySheetResult>(BabySheetComponent).subscribe((result) => {
      if (result && 'saved' in result) {
        this.store.add(result.saved);
      }
    });
  }
}
