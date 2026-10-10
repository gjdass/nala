import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { SHEET_DATA, SheetRef } from './sheet-ref';
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
  let backdrop: Subject<MouseEvent>;
  let keydown: Subject<KeyboardEvent>;
  const nativeRef = { dismiss: vi.fn(), close: vi.fn() };

  beforeEach(() => {
    phone = true;
    dismissed = new Subject();
    closed = new Subject();
    backdrop = new Subject();
    keydown = new Subject();
    nativeRef.dismiss.mockClear();
    nativeRef.close.mockClear();
    bottomSheet = {
      open: vi.fn(() => ({
        dismiss: nativeRef.dismiss,
        afterDismissed: () => dismissed,
        backdropClick: () => backdrop,
        keydownEvents: () => keydown,
      })),
    };
    dialog = {
      open: vi.fn(() => ({
        close: nativeRef.close,
        afterClosed: () => closed,
        backdropClick: () => backdrop,
        keydownEvents: () => keydown,
      })),
    };
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

  it('opens a bottom sheet on a phone, closed by the service, not by Material', () => {
    TestBed.inject(SheetService).open(SheetBodyComponent);

    expect(dialog.open).not.toHaveBeenCalled();
    expect(bottomSheet.open).toHaveBeenCalledWith(
      SheetBodyComponent,
      expect.objectContaining({ disableClose: true }),
    );
  });

  it('opens a dialog on a wide screen, closed by the service, not by Material', () => {
    phone = false;
    TestBed.inject(SheetService).open(SheetBodyComponent);

    expect(bottomSheet.open).not.toHaveBeenCalled();
    expect(dialog.open).toHaveBeenCalledWith(
      SheetBodyComponent,
      expect.objectContaining({ disableClose: true }),
    );
  });

  it('gives the bottom sheet the panel class it is opened with', () => {
    TestBed.inject(SheetService).open(SheetBodyComponent, null, 'nala-scheme-feed');

    expect(bottomSheet.open).toHaveBeenCalledWith(
      SheetBodyComponent,
      expect.objectContaining({ panelClass: 'nala-scheme-feed' }),
    );
  });

  it('gives the dialog the panel class it is opened with', () => {
    phone = false;
    TestBed.inject(SheetService).open(SheetBodyComponent, null, 'nala-scheme-feed');

    expect(dialog.open).toHaveBeenCalledWith(
      SheetBodyComponent,
      expect.objectContaining({ panelClass: 'nala-scheme-feed' }),
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

  /** The data the opened component would inject. */
  const injectedData = (open: ReturnType<typeof vi.fn>): unknown =>
    open.mock.calls[0][1].injector.get(SHEET_DATA);

  it('hands data to the bottom sheet', () => {
    TestBed.inject(SheetService).open(SheetBodyComponent, { id: 'b1' });

    expect(injectedData(bottomSheet.open)).toEqual({ id: 'b1' });
  });

  it('hands data to the dialog', () => {
    phone = false;
    TestBed.inject(SheetService).open(SheetBodyComponent, { id: 'b1' });

    expect(injectedData(dialog.open)).toEqual({ id: 'b1' });
  });

  it('provides null data when none is given', () => {
    TestBed.inject(SheetService).open(SheetBodyComponent);

    expect(injectedData(bottomSheet.open)).toBeNull();
  });

  describe('tapping outside or Escape', () => {
    const escape = () => new KeyboardEvent('keydown', { key: 'Escape' });

    it('closes the bottom sheet without a result on a tap outside', () => {
      TestBed.inject(SheetService).open(SheetBodyComponent);

      backdrop.next(new MouseEvent('click'));

      expect(nativeRef.dismiss).toHaveBeenCalledWith(undefined);
    });

    it('closes the bottom sheet without a result on Escape', () => {
      TestBed.inject(SheetService).open(SheetBodyComponent);

      keydown.next(escape());

      expect(nativeRef.dismiss).toHaveBeenCalledWith(undefined);
    });

    it('closes the dialog without a result on a tap outside', () => {
      phone = false;
      TestBed.inject(SheetService).open(SheetBodyComponent);

      backdrop.next(new MouseEvent('click'));

      expect(nativeRef.close).toHaveBeenCalledWith(undefined);
    });

    it('closes the dialog without a result on Escape', () => {
      phone = false;
      TestBed.inject(SheetService).open(SheetBodyComponent);

      keydown.next(escape());

      expect(nativeRef.close).toHaveBeenCalledWith(undefined);
    });

    it('ignores other keys', () => {
      TestBed.inject(SheetService).open(SheetBodyComponent);

      keydown.next(new KeyboardEvent('keydown', { key: 'Enter' }));
      keydown.next(new KeyboardEvent('keydown', { key: 'Escape', shiftKey: true }));

      expect(nativeRef.dismiss).not.toHaveBeenCalled();
    });

    it("runs the sheet's dismiss hook instead of closing, when it set one", () => {
      TestBed.inject(SheetService).open(SheetBodyComponent);
      const hook = vi.fn();
      injectedRef(bottomSheet.open).onDismiss = hook;

      backdrop.next(new MouseEvent('click'));
      keydown.next(escape());

      expect(hook).toHaveBeenCalledTimes(2);
      expect(nativeRef.dismiss).not.toHaveBeenCalled();
    });
  });
});
