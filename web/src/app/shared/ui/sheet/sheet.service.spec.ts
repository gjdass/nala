import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { SheetRef } from './sheet-ref';
import { SheetService } from './sheet.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `sheet body`,
})
class SheetBodyComponent {
  readonly ref = inject<SheetRef<string>>(SheetRef);
}

describe('SheetService', () => {
  let phone: boolean;
  let bottomSheet: { open: ReturnType<typeof vi.fn> };
  let dialog: { open: ReturnType<typeof vi.fn> };
  let dismissed: Subject<string | undefined>;
  let closed: Subject<string | undefined>;
  const nativeRef = { dismiss: vi.fn(), close: vi.fn() };

  beforeEach(() => {
    phone = true;
    dismissed = new Subject();
    closed = new Subject();
    nativeRef.dismiss.mockClear();
    nativeRef.close.mockClear();
    bottomSheet = {
      open: vi.fn(() => ({ dismiss: nativeRef.dismiss, afterDismissed: () => dismissed })),
    };
    dialog = { open: vi.fn(() => ({ close: nativeRef.close, afterClosed: () => closed })) };
    TestBed.configureTestingModule({
      providers: [
        { provide: BreakpointObserver, useValue: { isMatched: () => phone } },
        { provide: MatBottomSheet, useValue: bottomSheet },
        { provide: MatDialog, useValue: dialog },
      ],
    });
  });

  /** The SheetRef the opened component would inject. */
  const injectedRef = (open: ReturnType<typeof vi.fn>): SheetRef<string> =>
    open.mock.calls[0][1].injector.get(SheetRef);

  it('opens a bottom sheet on a phone, only closable from inside', () => {
    TestBed.inject(SheetService).open(SheetBodyComponent);

    expect(dialog.open).not.toHaveBeenCalled();
    expect(bottomSheet.open).toHaveBeenCalledWith(
      SheetBodyComponent,
      expect.objectContaining({ disableClose: true }),
    );
  });

  it('opens a dialog on a wide screen, only closable from inside', () => {
    phone = false;
    TestBed.inject(SheetService).open(SheetBodyComponent);

    expect(bottomSheet.open).not.toHaveBeenCalled();
    expect(dialog.open).toHaveBeenCalledWith(
      SheetBodyComponent,
      expect.objectContaining({ disableClose: true }),
    );
  });

  it('lets the bottom sheet close itself with a result', () => {
    const results: (string | undefined)[] = [];
    TestBed.inject(SheetService)
      .open<SheetBodyComponent, string>(SheetBodyComponent)
      .subscribe((r) => results.push(r));

    injectedRef(bottomSheet.open).close('saved');
    expect(nativeRef.dismiss).toHaveBeenCalledWith('saved');
    dismissed.next('saved');

    expect(results).toEqual(['saved']);
  });

  it('lets the dialog close itself with a result', () => {
    phone = false;
    const results: (string | undefined)[] = [];
    TestBed.inject(SheetService)
      .open<SheetBodyComponent, string>(SheetBodyComponent)
      .subscribe((r) => results.push(r));

    injectedRef(dialog.open).close();
    expect(nativeRef.close).toHaveBeenCalledWith(undefined);
    closed.next(undefined);

    expect(results).toEqual([undefined]);
  });
});
