import { Injectable, inject } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { Observable, from, of, switchMap } from 'rxjs';
import { sectionScheme } from '../../../core/sections/section-scheme';
import { SECTIONS, SectionKey, SectionKind } from '../../../core/sections/section.models';
import { KindPickerComponent, KindPickerData } from '../kind-picker/kind-picker.component';
import { SheetService } from '../sheet/sheet.service';
import { EntrySheetData, EntrySheetResult } from './entry-sheet.models';

type Closed = Observable<EntrySheetResult | undefined>;

/**
 * Opens a section's entry sheets (spec 04): + goes through the kind picker when the section has
 * several kinds, straight to the sheet with one; editing opens the entry's kind sheet pre-filled.
 * Emits what the sheet closed with (undefined when closed without a result), then completes.
 */
@Injectable({ providedIn: 'root' })
export class EntrySheetService {
  private readonly sections = new Map(inject(SECTIONS).map((s) => [s.key, s]));
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly sheets = inject(SheetService);

  add(key: SectionKey): Closed {
    const kinds = this.sections.get(key)?.kinds ?? [];
    if (kinds.length === 0) {
      return of(undefined);
    }
    if (kinds.length === 1) {
      return this.open(key, kinds[0], null);
    }
    return this.bottomSheet
      .open<KindPickerComponent, KindPickerData, SectionKind>(KindPickerComponent, {
        data: { kinds },
        panelClass: sectionScheme(key),
      })
      .afterDismissed()
      .pipe(switchMap((kind) => (kind ? this.open(key, kind, null) : of(undefined))));
  }

  edit<T>(key: SectionKey, kindKey: string, entry: T): Closed {
    const kind = this.sections.get(key)?.kinds.find((k) => k.key === kindKey);
    return kind ? this.open(key, kind, entry) : of(undefined);
  }

  /** Loads the kind's sheet (kept out of the initial bundle), then opens it. */
  private open(section: SectionKey, kind: SectionKind, entry: unknown): Closed {
    const data: EntrySheetData = { section, kind, entry };
    return from(kind.loadSheet()).pipe(
      switchMap((sheet) =>
        this.sheets.open<unknown, EntrySheetResult>(sheet, data, sectionScheme(section)),
      ),
    );
  }
}
