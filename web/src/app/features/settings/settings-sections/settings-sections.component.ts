import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { take } from 'rxjs';
import { SECTIONS, SectionKey, SectionPreference } from '../../../core/sections/section.models';
import { SectionPreferencesService } from '../../../core/sections/section-preferences.service';

const SNACK_DURATION = 3000;

/**
 * The user's home sections: drag to reorder, switch to show or hide. Only built sections are listed;
 * the others keep their place in the saved list. At least one listed section stays visible.
 */
@Component({
  selector: 'nala-settings-sections',
  imports: [
    CdkDrag,
    CdkDragHandle,
    CdkDropList,
    MatIconModule,
    MatListModule,
    MatSlideToggleModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-sections.component.html',
  styleUrl: './settings-sections.component.scss',
})
export class SettingsSectionsComponent {
  private readonly store = inject(SectionPreferencesService);
  private readonly built = new Set(inject(SECTIONS).map((s) => s.key));
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  /** The built sections, in the user's order. */
  protected readonly rows = computed(() =>
    (this.store.preferences() ?? []).filter((p) => this.built.has(p.key)),
  );
  private readonly visibleCount = computed(() => this.rows().filter((r) => r.visible).length);

  constructor() {
    this.store.load();
  }

  /** The last visible section can't be hidden. */
  protected locked(row: SectionPreference): boolean {
    return row.visible && this.visibleCount() === 1;
  }

  /** The built sections take the new order within the slots they already had. */
  protected drop(event: Pick<CdkDragDrop<unknown>, 'previousIndex' | 'currentIndex'>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }
    const reordered = [...this.rows()];
    moveItemInArray(reordered, event.previousIndex, event.currentIndex);
    let next = 0;
    this.save(
      this.store.preferences()!.map((p) => (this.built.has(p.key) ? reordered[next++] : p)),
    );
  }

  protected setVisible(key: SectionKey, visible: boolean): void {
    this.save(this.store.preferences()!.map((p) => (p.key === key ? { ...p, visible } : p)));
  }

  private save(sections: SectionPreference[]): void {
    this.store.save(sections).subscribe((result) => {
      if (!result.ok) {
        this.transloco
          .selectTranslate('settings.sections.saveFailed')
          .pipe(take(1))
          .subscribe((message) =>
            this.snackBar.open(message, undefined, { duration: SNACK_DURATION }),
          );
      }
    });
  }
}
