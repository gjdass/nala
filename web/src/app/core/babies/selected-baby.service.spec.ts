import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { BabiesResult, Baby } from './baby.models';
import { CurrentFamilyService } from '../families/current-family.service';
import { BabyService } from './baby.service';
import { SelectedBabyService } from './selected-baby.service';

const KEY = 'nala.baby';

describe('SelectedBabyService', () => {
  let listed: Subject<BabiesResult>;
  let families: { refresh: ReturnType<typeof vi.fn> };

  const baby = (id: string, name: string, birthDate: string): Baby => ({
    id,
    familyId: 'f1',
    name,
    birthDate,
    sex: 'unspecified',
    birthWeightG: null,
    birthLengthCm: null,
    birthHeadCircumferenceCm: null,
  });
  const tom = baby('b1', 'Tom', '2026-05-18');
  const lea = baby('b2', 'Lea', '2026-09-23');

  const loaded = (result: BabiesResult) => {
    const store = TestBed.inject(SelectedBabyService);
    store.refresh();
    listed.next(result);
    return store;
  };

  beforeEach(() => {
    localStorage.clear();
    listed = new Subject<BabiesResult>();
    families = { refresh: vi.fn() };
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
});
