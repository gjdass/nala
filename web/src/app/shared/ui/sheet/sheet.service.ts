import { BreakpointObserver } from '@angular/cdk/layout';
import { ComponentType } from '@angular/cdk/portal';
import { Injectable, Injector, inject } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { SheetRef } from './sheet-ref';

/** Below this width the sheet slides up from the bottom; above, it is a dialog. */
const PHONE = '(max-width: 599.98px)';

class DelegatingSheetRef<R> extends SheetRef<R> {
  closeWith: (result?: R) => void = () => undefined;

  close(result?: R): void {
    this.closeWith(result);
  }
}

/**
 * Opens a form sheet (add / edit): a bottom sheet on phones, a dialog on wide screens.
 * The component injects `SheetRef` to close itself; backdrop and Escape don't close it, so it can
 * ask before discarding changes.
 */
@Injectable({ providedIn: 'root' })
export class SheetService {
  private readonly breakpoints = inject(BreakpointObserver);
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);

  /** Emits the result the component closed with (undefined when closed without one), then completes. */
  open<C, R = unknown>(component: ComponentType<C>): Observable<R | undefined> {
    const ref = new DelegatingSheetRef<R>();
    const injector = Injector.create({
      providers: [{ provide: SheetRef, useValue: ref }],
      parent: this.injector,
    });

    if (this.breakpoints.isMatched(PHONE)) {
      const sheet = this.bottomSheet.open<C, unknown, R>(component, {
        injector,
        disableClose: true,
      });
      ref.closeWith = (result) => sheet.dismiss(result);
      return sheet.afterDismissed();
    }

    const dialog = this.dialog.open<C, unknown, R>(component, {
      injector,
      disableClose: true,
      width: '560px',
      maxWidth: '100vw',
    });
    ref.closeWith = (result) => dialog.close(result);
    return dialog.afterClosed();
  }
}
