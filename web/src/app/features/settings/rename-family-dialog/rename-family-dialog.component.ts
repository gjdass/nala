import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { Family } from '../../../core/families/family.models';
import { FamilyService } from '../../../core/families/family.service';
import {
  FamilyNameFieldComponent,
  createFamilyNameControl,
} from '../../../shared/ui/family-name-field/family-name-field.component';

export interface RenameFamilyDialogData {
  family: Family;
}

/** Renames a family (family admin only); closes with the renamed family once saved. */
@Component({
  selector: 'nala-rename-family-dialog',
  imports: [
    FamilyNameFieldComponent,
    MatButtonModule,
    MatDialogModule,
    ReactiveFormsModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rename-family-dialog.component.html',
  styleUrl: './rename-family-dialog.component.scss',
})
export class RenameFamilyDialogComponent {
  private readonly families = inject(FamilyService);
  private readonly dialogRef =
    inject<MatDialogRef<RenameFamilyDialogComponent, Family>>(MatDialogRef);
  private readonly family = inject<RenameFamilyDialogData>(MAT_DIALOG_DATA).family;

  protected readonly form = new FormGroup({ name: createFamilyNameControl(this.family.name) });
  protected readonly name = this.form.controls.name;
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected save(): void {
    this.name.markAsTouched();
    if (this.name.invalid || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    this.families.rename(this.family.id, this.name.value.trim()).subscribe((result) => {
      this.saving.set(false);
      if (result.ok) {
        this.dialogRef.close(result.family);
      } else if (result.errors['name']) {
        this.name.setErrors({ server: result.errors['name'] });
      } else {
        this.formError.set('unknown');
      }
    });
  }

  protected cancel(): void {
    this.dialogRef.close();
  }
}
