import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { CurrentFamilyService } from './current-family.service';
import { FamiliesResult, Family } from './family.models';
import { FamilyService } from './family.service';

describe('CurrentFamilyService', () => {
  let listed: Subject<FamiliesResult>;
  let api: { list: ReturnType<typeof vi.fn> };

  const martins: Family = { id: 'f1', name: 'Martins', isAdmin: false };
  const durands: Family = { id: 'f2', name: 'Durands', isAdmin: true };

  const loaded = (result: FamiliesResult) => {
    const store = TestBed.inject(CurrentFamilyService);
    store.refresh();
    listed.next(result);
    return store;
  };

  beforeEach(() => {
    listed = new Subject<FamiliesResult>();
    api = { list: vi.fn(() => listed) };
    TestBed.configureTestingModule({
      providers: [{ provide: FamilyService, useValue: api }],
    });
  });

  it('has no family before they are loaded', () => {
    const store = TestBed.inject(CurrentFamilyService);

    expect(store.families()).toBeNull();
    expect(store.current()).toBeNull();
    expect(api.list).not.toHaveBeenCalled();
  });

  it('loads the families and makes the first one current', () => {
    const store = loaded({ ok: true, families: [martins, durands] });

    expect(store.families()).toEqual([martins, durands]);
    expect(store.current()).toEqual(martins);
  });

  it('has no current family when the user is in none', () => {
    expect(loaded({ ok: true, families: [] }).current()).toBeNull();
  });

  it('keeps what it had when loading fails', () => {
    const store = loaded({ ok: true, families: [martins] });
    store.refresh();
    listed.next({ ok: false, errors: { form: 'unknown' } });

    expect(store.current()).toEqual(martins);
  });

  it("tells whether the user is a family's admin", () => {
    const store = loaded({ ok: true, families: [martins, durands] });

    expect(store.isAdminOf('f1')).toBe(false);
    expect(store.isAdminOf('f2')).toBe(true);
    expect(store.isAdminOf('elsewhere')).toBe(false);
  });
});
