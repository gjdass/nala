import { hasModifierKey } from '@angular/cdk/keycodes';
import { BreakpointObserver } from '@angular/cdk/layout';
import { ComponentType } from '@angular/cdk/portal';
import { Injectable, Injector, inject } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { Observable, filter, merge } from 'rxjs';
import { SHEET_DATA, SheetRef } from './sheet-ref';

/** Below this width the sheet slides up from the bottom; above, it is a dialog. */
const PHONE = '(max-width: 599.98px)';

class DelegatingSheetRef<R> extends SheetRef<R> {
  closeWith: (result?: R) => void = () => undefined;

  close(result?: R): void {
    this.closeWith(result);
  }

  /** A tap outside the sheet or Escape: the sheet's hook, else closing without a result. */
  dismiss(): void {
    (this.onDismiss ?? (() => this.close()))();
  }
}

/** What Material reports on an open bottom sheet or dialog. */
interface OutsideEvents {
  backdropClick(): Observable<MouseEvent>;
  keydownEvents(): Observable<KeyboardEvent>;
}

/** Taps outside the sheet (on its backdrop) and Escape. */
const dismissals = (ref: OutsideEvents): Observable<unknown> =>
  merge(
    ref.backdropClick(),
    ref.keydownEvents().pipe(filter((e) => e.key === 'Escape' && !hasModifierKey(e))),
  );

/**
 * Opens a form sheet (add / edit): a bottom sheet on phones, a dialog on wide screens.
 * The component injects `SheetRef` to close itself and `SHEET_DATA` for the data it was opened
 * with. A tap outside the sheet or Escape discards it at once, without asking (spec 04): it closes
 * without a result, unless the component set `SheetRef.onDismiss` (e.g. a timer sheet closing with
 * the entry its taps changed). Material never closes it by itself, so × can ask first.
 */
@Injectable({ providedIn: 'root' })
export class SheetService {
  private readonly breakpoints = inject(BreakpointObserver);
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);

  /**
   * Emits the result the component closed with (undefined when closed without one), then completes.
   * `panelClass` goes on the sheet's overlay panel (e.g. a section's colour scheme).
   */
  open<C, R = unknown>(
    component: ComponentType<C>,
    data: unknown = null,
    panelClass?: string,
  ): Observable<R | undefined> {
    const ref = new DelegatingSheetRef<R>();
    const injector = Injector.create({
      providers: [
        { provide: SheetRef, useValue: ref },
        { provide: SHEET_DATA, useValue: data },
      ],
      parent: this.injector,
    });

    if (this.breakpoints.isMatched(PHONE)) {
      const sheet = this.bottomSheet.open<C, unknown, R>(component, {
        injector,
        disableClose: true,
        panelClass,
      });
      ref.closeWith = (result) => sheet.dismiss(result);
      dismissals(sheet).subscribe(() => ref.dismiss());
      return sheet.afterDismissed();
    }

    const dialog = this.dialog.open<C, unknown, R>(component, {
      injector,
      disableClose: true,
      panelClass,
      width: '560px',
      maxWidth: '100vw',
    });
    ref.closeWith = (result) => dialog.close(result);
    dismissals(dialog).subscribe(() => ref.dismiss());
    return dialog.afterClosed();
  }
}
