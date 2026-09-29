import { InjectionToken } from '@angular/core';

/** Injected into a component opened by `SheetService`, to close it with a result. */
export abstract class SheetRef<R = unknown> {
  abstract close(result?: R): void;
}

/** The data given to `SheetService.open`, or null. */
export const SHEET_DATA = new InjectionToken<unknown>('SHEET_DATA');
