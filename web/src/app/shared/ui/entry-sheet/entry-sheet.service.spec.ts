import { TestBed } from '@angular/core/testing';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { Subject } from 'rxjs';
import { SECTIONS, SectionKind } from '../../../core/sections/section.models';
import { FakeKindSheet, fakeKind, fakeSection } from '../../../testing/fake-section';
import { KindPickerComponent } from '../kind-picker/kind-picker.component';
import { SheetService } from '../sheet/sheet.service';
import { EntrySheetResult } from './entry-sheet.models';
import { EntrySheetService } from './entry-sheet.service';

describe('EntrySheetService', () => {
  const bottle = fakeKind('bottle');
  const solids = fakeKind('solids');
  const wet = fakeKind('change');

  let picked: Subject<SectionKind | undefined>;
  let closed: Subject<EntrySheetResult | undefined>;
  let bottomSheet: { open: ReturnType<typeof vi.fn> };
  let sheets: { open: ReturnType<typeof vi.fn> };

  const service = () => TestBed.inject(EntrySheetService);

  beforeEach(() => {
    picked = new Subject();
    closed = new Subject();
    bottomSheet = { open: vi.fn(() => ({ afterDismissed: () => picked })) };
    sheets = { open: vi.fn(() => closed) };
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SECTIONS,
          useValue: [
            fakeSection('feed', 'restaurant', [bottle, solids]),
            fakeSection('diaper', 'baby_changing_station', [wet]),
          ],
        },
        { provide: MatBottomSheet, useValue: bottomSheet },
        { provide: SheetService, useValue: sheets },
      ],
    });
  });

  describe('add', () => {
    it('opens the kind picker when the section has several kinds, then the picked kind sheet', async () => {
      service().add('feed').subscribe();

      expect(bottomSheet.open).toHaveBeenCalledWith(KindPickerComponent, {
        data: { kinds: [bottle, solids] },
        panelClass: 'nala-scheme-feed',
      });
      expect(sheets.open).not.toHaveBeenCalled();

      picked.next(solids);

      await vi.waitFor(() => expect(sheets.open).toHaveBeenCalled());
      expect(sheets.open).toHaveBeenCalledWith(FakeKindSheet, {
        section: 'feed',
        kind: solids,
        entry: null,
      }, 'nala-scheme-feed');
    });

    it('opens nothing more when the kind picker is dismissed without a choice', () => {
      const results: unknown[] = [];
      service()
        .add('feed')
        .subscribe((r) => results.push(r));

      picked.next(undefined);

      expect(sheets.open).not.toHaveBeenCalled();
      expect(results).toEqual([undefined]);
    });

    it('opens the entry sheet directly when the section has one kind, once it is loaded', async () => {
      const loadSheet = vi.spyOn(wet, 'loadSheet');
      service().add('diaper').subscribe();

      expect(bottomSheet.open).not.toHaveBeenCalled();
      expect(loadSheet).toHaveBeenCalledTimes(1);
      await vi.waitFor(() => expect(sheets.open).toHaveBeenCalled());
      expect(sheets.open).toHaveBeenCalledWith(FakeKindSheet, {
        section: 'diaper',
        kind: wet,
        entry: null,
      }, 'nala-scheme-diaper');
    });

    it('emits what the sheet closed with', async () => {
      const results: unknown[] = [];
      service()
        .add('diaper')
        .subscribe((r) => results.push(r));
      await vi.waitFor(() => expect(sheets.open).toHaveBeenCalled());

      closed.next({ saved: { id: 'd1' } });

      expect(results).toEqual([{ saved: { id: 'd1' } }]);
    });

    it('opens nothing for a section that is not built', () => {
      const results: unknown[] = [];
      service()
        .add('pump')
        .subscribe((r) => results.push(r));

      expect(bottomSheet.open).not.toHaveBeenCalled();
      expect(sheets.open).not.toHaveBeenCalled();
      expect(results).toEqual([undefined]);
    });
  });

  describe('edit', () => {
    it("opens the entry's kind sheet pre-filled with the entry, and emits its result", async () => {
      const results: unknown[] = [];
      const entry = { id: 'f1' };
      service()
        .edit('feed', 'solids', entry)
        .subscribe((r) => results.push(r));

      expect(bottomSheet.open).not.toHaveBeenCalled();
      await vi.waitFor(() => expect(sheets.open).toHaveBeenCalled());
      expect(sheets.open).toHaveBeenCalledWith(FakeKindSheet, {
        section: 'feed',
        kind: solids,
        entry,
      }, 'nala-scheme-feed');

      closed.next({ deleted: 'f1' });
      expect(results).toEqual([{ deleted: 'f1' }]);
    });

    it('opens nothing for an unknown kind', () => {
      const results: unknown[] = [];
      service()
        .edit('feed', 'nope', { id: 'f1' })
        .subscribe((r) => results.push(r));

      expect(sheets.open).not.toHaveBeenCalled();
      expect(results).toEqual([undefined]);
    });
  });
});
