/** Injected into a component opened by `SheetService`, to close it with a result. */
export abstract class SheetRef<R = unknown> {
  abstract close(result?: R): void;
}
