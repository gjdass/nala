import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { TranslocoPipe } from '@jsverse/transloco';
import { SectionKind } from '../../../core/sections/section.models';

export interface KindPickerData {
  kinds: readonly SectionKind[];
}

/** Bottom action sheet listing a section's kinds of entry; dismisses with the one tapped. */
@Component({
  selector: 'nala-kind-picker',
  imports: [MatIconModule, MatListModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './kind-picker.component.html',
})
export class KindPickerComponent {
  private readonly sheetRef =
    inject<MatBottomSheetRef<KindPickerComponent, SectionKind>>(MatBottomSheetRef);
  protected readonly data = inject<KindPickerData>(MAT_BOTTOM_SHEET_DATA);

  protected pick(kind: SectionKind): void {
    this.sheetRef.dismiss(kind);
  }
}
