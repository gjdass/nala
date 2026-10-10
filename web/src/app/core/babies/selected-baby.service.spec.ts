import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { BabiesResult, Baby } from './baby.models';
import { CurrentFamilyService } from '../families/current-family.service';
import { Family } from '../families/family.models';
import { BabyService } from './baby.service';
import { SelectedBabyService } from './selected-baby.service';

const KEY = 'nala.baby';

describe('SelectedBabyService', () => {
  let listed: Subject<BabiesResult>;
  let families: {
    families: ReturnType<typeof signal<Family[] | null>>;
    current: ReturnType<typeof signal<Family | null>>;
    loadError: ReturnType<typeof signal<boolean>>;
    refresh: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
  };

  const martins: Family = { id: 'f1', name: 'Martins', isAdmin: true };
  const durands: Family = { id: 'f2', name: 'Durands', isAdmin: false };

  const baby = (id: string, name: string, birthDate: string, familyId = 'f1'): Baby => ({
    id,
    familyId,
    name,
    birthDate,
    sex: 'unspecified',
    birthWeightG: null,
    birthLengthCm: null,
    birthHeadCircumferenceCm: null,
  });
  const tom = baby('b1', 'Tom', '2026-05-18');
  const lea = baby('b2', 'Lea', '2026-09-23');
  const zoe = baby('b3', 'Zoe', '2026-03-02', 'f2');

  /** The user's families, the first one current, as the real store does without a stored one. */
  const inFamilies = (...list: Family[]) => {
    families.families.set(list);
    families.current.set(list[0] ?? null);
  };

  const loaded = (result: BabiesResult) => {
    const store = TestBed.inject(SelectedBabyService);
    store.refresh();
    listed.next(result);
    return store;
  };

  beforeEach(() => {
    localStorage.clear();
    listed = new Subject<BabiesResult>();
    families = {
      families: signal<Family[] | null>(null),
      current: signal<Family | null>(null),
      loadError: signal(false),
      refresh: vi.fn(),
      select: vi.fn((id: string) =>
        families.current.set(families.families()?.find((f) => f.id === id) ?? null),
      ),
    };
    inFamilies(martins);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: BabyService, useValue: { list: () => listed } },
        { provide: CurrentFamilyService, useValue: families },
      ],
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('loads the babies and selects the first one when nothing is stored', () => {
    const store = loaded({ ok: true, babies: [tom, lea] });

    expect(store.babies()).toEqual([tom, lea]);
    expect(store.selected()).toEqual(tom);
  });

  it('refreshes the families along with the babies', () => {
    loaded({ ok: true, babies: [tom] });

    expect(families.refresh).toHaveBeenCalledOnce();
  });

  it('has no babies before they are loaded', () => {
    const store = TestBed.inject(SelectedBabyService);

    expect(store.babies()).toBeNull();
    expect(store.selected()).toBeNull();
  });

  it('restores the baby stored under nala.baby', () => {
    localStorage.setItem(KEY, lea.id);

    expect(loaded({ ok: true, babies: [tom, lea] }).selected()).toEqual(lea);
  });

  it('falls back to the first baby when the stored one no longer exists', () => {
    localStorage.setItem(KEY, 'gone');

    expect(loaded({ ok: true, babies: [tom, lea] }).selected()).toEqual(tom);
  });

  it('select() changes the selected baby and stores its id under nala.baby', () => {
    const store = loaded({ ok: true, babies: [tom, lea] });

    store.select(lea.id);

    expect(store.selected()).toEqual(lea);
    expect(localStorage.getItem(KEY)).toBe(lea.id);
  });

  it('has no selected baby when the family has none', () => {
    expect(loaded({ ok: true, babies: [] }).selected()).toBeNull();
  });

  it('add() inserts a new baby in birth order', () => {
    const store = loaded({ ok: true, babies: [lea] });

    store.add(tom);

    expect(store.babies()).toEqual([tom, lea]);
  });

  it('add() of the first baby selects it', () => {
    const store = loaded({ ok: true, babies: [] });

    store.add(lea);

    expect(store.selected()).toEqual(lea);
  });

  it('update() replaces a baby, kept in birth order', () => {
    const store = loaded({ ok: true, babies: [tom, lea] });
    const older = { ...lea, name: 'Léa', birthDate: '2026-01-02' };

    store.update(older);

    expect(store.babies()).toEqual([older, tom]);
  });

  it('update() of the selected baby updates the selection', () => {
    const store = loaded({ ok: true, babies: [tom, lea] });
    const heavier = { ...tom, birthWeightG: 3400 };

    store.update(heavier);

    expect(store.selected()).toEqual(heavier);
  });

  it('remove() drops a baby, the first one left is then selected', () => {
    localStorage.setItem(KEY, lea.id);
    const store = loaded({ ok: true, babies: [tom, lea] });

    store.remove(lea.id);

    expect(store.babies()).toEqual([tom]);
    expect(store.selected()).toEqual(tom);
  });

  it('keeps the selected baby as it was when the reloaded babies did not change', () => {
    const store = loaded({ ok: true, babies: [tom, lea] });
    const before = store.selected();

    store.refresh();
    listed.next({ ok: true, babies: [{ ...tom }, { ...lea }] });

    expect(store.selected()).toBe(before);
  });

  it('takes a baby changed elsewhere when reloaded', () => {
    const store = loaded({ ok: true, babies: [tom, lea] });
    const renamed = { ...tom, name: 'Tommy' };

    store.refresh();
    listed.next({ ok: true, babies: [renamed, { ...lea }] });

    expect(store.selected()).toEqual(renamed);
    expect(store.babies()).toEqual([renamed, lea]);
  });

  it('reports a load error', () => {
    const store = loaded({ ok: false, errors: { form: 'unknown' } });

    expect(store.loadError()).toBe(true);
    expect(store.selected()).toBeNull();
  });

  it('still works when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const store = loaded({ ok: true, babies: [tom, lea] });

    expect(store.selected()).toEqual(tom);
    store.select(lea.id);
    expect(store.selected()).toEqual(lea);
  });
  describe('across families', () => {
    beforeEach(() => inFamilies(martins, durands));

    it('babies() holds every family\'s babies, familyBabies() only the current family\'s', () => {
      const store = loaded({ ok: true, babies: [zoe, tom, lea] });

      expect(store.babies()).toEqual([zoe, tom, lea]);
      expect(store.familyBabies()).toEqual([tom, lea]);
      expect(store.selected()).toEqual(tom);
    });

    it("falls back to the current family's first baby when the stored one is in another family", () => {
      localStorage.setItem(KEY, zoe.id);

      expect(loaded({ ok: true, babies: [zoe, tom, lea] }).selected()).toEqual(tom);
    });

    it('select() selects the baby and its family', () => {
      const store = loaded({ ok: true, babies: [zoe, tom, lea] });

      store.select(zoe.id);

      expect(families.select).toHaveBeenCalledWith('f2');
      expect(store.selected()).toEqual(zoe);
      expect(localStorage.getItem(KEY)).toBe(zoe.id);
    });

    it('selectFamily() selects a family without a baby: no baby is selected', () => {
      const store = loaded({ ok: true, babies: [tom, lea] });

      store.selectFamily('f2');

      expect(families.select).toHaveBeenCalledWith('f2');
      expect(store.familyBabies()).toEqual([]);
      expect(store.selected()).toBeNull();
    });
  });

  describe('screen()', () => {
    it('is loading until the babies are loaded', () => {
      expect(TestBed.inject(SelectedBabyService).screen()).toBe('loading');
    });

    it('is loading until the families are loaded', () => {
      families.families.set(null);
      families.current.set(null);

      expect(loaded({ ok: true, babies: [tom] }).screen()).toBe('loading');
    });

    it('is error when the babies cannot be loaded', () => {
      expect(loaded({ ok: false, errors: { form: 'unknown' } }).screen()).toBe('error');
    });

    it('is error when the families cannot be loaded', () => {
      families.loadError.set(true);

      expect(loaded({ ok: true, babies: [tom] }).screen()).toBe('error');
    });

    it('is noFamily when the user is in no family', () => {
      inFamilies();

      expect(loaded({ ok: true, babies: [] }).screen()).toBe('noFamily');
    });

    it('is noBaby when the current family has no baby, even if another one has', () => {
      inFamilies(durands, martins);

      expect(loaded({ ok: true, babies: [tom] }).screen()).toBe('noBaby');
    });

    it('is ready when a baby is selected', () => {
      expect(loaded({ ok: true, babies: [tom] }).screen()).toBe('ready');
    });
  });
});
