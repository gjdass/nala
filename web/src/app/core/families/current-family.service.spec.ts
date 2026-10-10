import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { CurrentFamilyService } from './current-family.service';
import { FamiliesResult, Family } from './family.models';
import { FamilyService } from './family.service';

const KEY = 'nala.family';

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
    localStorage.clear();
    listed = new Subject<FamiliesResult>();
    api = { list: vi.fn(() => listed) };
    TestBed.configureTestingModule({
      providers: [{ provide: FamilyService, useValue: api }],
    });
  });

  afterEach(() => vi.restoreAllMocks());

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

  it('restores the family stored under nala.family', () => {
    localStorage.setItem(KEY, durands.id);

    expect(loaded({ ok: true, families: [martins, durands] }).current()).toEqual(durands);
  });

  it('falls back to the first family when the stored one is no longer theirs', () => {
    localStorage.setItem(KEY, 'gone');

    expect(loaded({ ok: true, families: [martins, durands] }).current()).toEqual(martins);
  });

  it('select() changes the current family and stores its id under nala.family', () => {
    const store = loaded({ ok: true, families: [martins, durands] });

    store.select(durands.id);

    expect(store.current()).toEqual(durands);
    expect(localStorage.getItem(KEY)).toBe(durands.id);
  });

  it('still works when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const store = loaded({ ok: true, families: [martins, durands] });

    expect(store.current()).toEqual(martins);
    store.select(durands.id);
    expect(store.current()).toEqual(durands);
  });

  it('reports a load error until a load succeeds', () => {
    const store = loaded({ ok: false, errors: { form: 'unknown' } });
    expect(store.loadError()).toBe(true);

    store.refresh();
    listed.next({ ok: true, families: [martins] });
    expect(store.loadError()).toBe(false);
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
