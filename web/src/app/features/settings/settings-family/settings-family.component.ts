import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { take } from 'rxjs';
import { CurrentFamilyService } from '../../../core/families/current-family.service';
import { Family } from '../../../core/families/family.models';
import {
  RenameFamilyDialogComponent,
  RenameFamilyDialogData,
} from '../rename-family-dialog/rename-family-dialog.component';

const SNACK_DURATION = 3000;

/** The current family's name; its family admin renames it in a dialog. */
@Component({
  selector: 'nala-settings-family',
  imports: [MatButtonModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-family.component.html',
  styleUrl: './settings-family.component.scss',
})
export class SettingsFamilyComponent {
  private readonly families = inject(CurrentFamilyService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  protected readonly family = this.families.current;

  protected rename(family: Family): void {
    this.dialog
      .open<RenameFamilyDialogComponent, RenameFamilyDialogData, Family>(
        RenameFamilyDialogComponent,
        { data: { family } },
      )
      .afterClosed()
      .subscribe((renamed) => {
        if (renamed) {
          // The top bar, the switcher and the families order follow the new name.
          this.families.refresh();
          this.transloco
            .selectTranslate('families.rename.done')
            .pipe(take(1))
            .subscribe((message) =>
              this.snackBar.open(message, undefined, { duration: SNACK_DURATION }),
            );
        }
      });
  }
}
