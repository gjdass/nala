import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import en from '../../../../../public/i18n/en.json';
import { Baby } from '../../../core/babies/baby.models';
import { Family } from '../../../core/families/family.models';
import { translocoTesting } from '../../../testing/transloco-testing';
import { TopAppBarComponent } from './top-app-bar.component';

describe('TopAppBarComponent', () => {
  let fixture: ComponentFixture<TopAppBarComponent>;

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

  const host = () => fixture.nativeElement as HTMLElement;
  const find = (testId: string) => document.querySelector(`[data-testid="${testId}"]`);
  const text = (testId: string) => find(testId)?.textContent?.trim();
  /** One family (Martins, current) unless said otherwise. */
  const show = async (
    babies: Baby[],
    selected: Baby | null,
    families: Family[] = [martins],
    family: Family | null = families[0] ?? null,
  ) => {
    fixture.componentRef.setInput('families', families);
    fixture.componentRef.setInput('family', family);
    fixture.componentRef.setInput('babies', babies);
    fixture.componentRef.setInput('selected', selected);
    await fixture.whenStable();
  };
  const openSwitcher = async () => {
    (find('baby-switcher') as HTMLButtonElement).click();
    await fixture.whenStable();
  };
  const menuItems = () => [
    ...document.querySelectorAll<HTMLButtonElement>('[data-testid="switcher-item"]'),
  ];

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 28, 9, 0));
    await TestBed.configureTestingModule({
      imports: [TopAppBarComponent, translocoTesting()],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(TopAppBarComponent);
  });

  afterEach(() => vi.useRealTimers());

  it("shows the selected baby's name and age", async () => {
    await show([tom, lea], lea);

    expect(text('selected-name')).toBe('Lea');
    expect(text('selected-age')).toBe('5 days');
  });

  it('with one baby, shows name + age as plain text, no switcher', async () => {
    await show([lea], lea);

    expect(text('selected-name')).toBe('Lea');
    expect(find('baby-switcher')).toBeNull();
  });

  it('with several babies, the switcher menu lists each baby with its age and marks the selected one', async () => {
    await show([tom, lea], lea);
    const switcher = find('baby-switcher') as HTMLButtonElement;
    expect(switcher.getAttribute('aria-label')).toBe(en.babies.switcher);

    await openSwitcher();

    expect(
      menuItems().map((item) => [
        item.querySelector('[data-testid="switcher-name"]')?.textContent?.trim(),
        item.querySelector('[data-testid="switcher-age"]')?.textContent?.trim(),
        item.getAttribute('aria-checked'),
      ]),
    ).toEqual([
      ['Tom', '4 months 10 days', 'false'],
      ['Lea', '5 days', 'true'],
    ]);
  });

  it("emits the chosen baby's id from the menu", async () => {
    const chosen = vi.fn();
    fixture.componentInstance.babySelected.subscribe(chosen);
    await show([tom, lea], lea);
    await openSwitcher();

    menuItems()[0].click();

    expect(chosen).toHaveBeenCalledWith(tom.id);
  });

  it('has no settings button: settings is a bottom navigation destination', async () => {
    await show([lea], lea);
    expect(find('settings')).toBeNull();
    expect(host().querySelector('a')).toBeNull();
  });

  it.each([
    ['one baby', [lea], lea],
    ['several babies', [tom, lea], lea],
    ['no baby', [], null],
  ] as const)(
    'shows the Nala brand (lion head + name), decorative, with %s',
    async (_, babies, selected) => {
      await show([...babies], selected);

      const brand = find('brand') as HTMLElement;
      expect(brand).not.toBeNull();
      expect(brand.textContent?.trim()).toBe('Nala');
      const lion = brand.querySelector('img') as HTMLImageElement;
      expect(lion.getAttribute('src')).toBe('icons/brand-mark.png');
      expect(lion.getAttribute('alt')).toBe('');
      expect(brand.closest('button, a')).toBeNull();
    },
  );

  it('shows "Nala" first, then the lion\'s head at 40 px, as tall as the name + age block', async () => {
    await show([lea], lea);

    const brand = find('brand') as HTMLElement;
    const name = brand.querySelector('[data-testid="brand-name"]') as HTMLElement;
    const lion = brand.querySelector('img') as HTMLImageElement;
    expect(name.textContent?.trim()).toBe('Nala');
    expect(name.nextElementSibling).toBe(lion);
    expect(lion.nextElementSibling).toBeNull();
    expect([lion.getAttribute('width'), lion.getAttribute('height')]).toEqual(['40', '40']);
  });

  it('with no family, shows only the brand', async () => {
    await show([], null, []);

    expect(find('selected-name')).toBeNull();
    expect(find('family-name')).toBeNull();
    expect(find('baby-switcher')).toBeNull();
    expect(find('settings')).toBeNull();
  });

  it("with one family and no baby, shows the family's name, no switcher", async () => {
    await show([], null);

    expect(text('family-name')).toBe('Martins');
    expect(find('selected-name')).toBeNull();
    expect(find('baby-switcher')).toBeNull();
  });

  describe('with several families', () => {
    const headings = () =>
      [...document.querySelectorAll('[data-testid="switcher-family"]')].map((h) =>
        h.textContent?.trim(),
      );
    /** Each item as "family > label (checked)". */
    const grouped = () =>
      [...document.querySelectorAll('[data-testid="switcher-group"]')].flatMap((group) =>
        [...group.querySelectorAll('[role="menuitemradio"]')].map(
          (item) =>
            `${group.getAttribute('aria-label')} > ${
              item.querySelector('[data-testid="switcher-name"]')?.textContent?.trim() ??
              item.textContent?.trim()
            } ${item.getAttribute('aria-checked')}`,
        ),
      );

    it('shows the switcher even with one baby', async () => {
      await show([tom], tom, [martins, durands]);

      expect(find('baby-switcher')).not.toBeNull();
      expect(text('selected-name')).toBe('Tom');
    });

    it('lists the babies under their family, in the families order', async () => {
      await show([zoe, tom, lea], lea, [durands, martins], martins);
      await openSwitcher();

      expect(headings()).toEqual(['Durands', 'Martins']);
      expect(grouped()).toEqual([
        'Durands > Zoe false',
        'Martins > Tom false',
        'Martins > Lea true',
      ]);
    });

    it('offers "No baby yet" for a family without a baby, emitting that family', async () => {
      const chosen = vi.fn();
      fixture.componentInstance.familySelected.subscribe(chosen);
      await show([tom], tom, [martins, durands], martins);
      await openSwitcher();

      expect(grouped()).toEqual(['Martins > Tom true', `Durands > ${en.families.noBaby} false`]);
      document.querySelector<HTMLButtonElement>('[data-testid="switcher-no-baby"]')!.click();
      expect(chosen).toHaveBeenCalledWith('f2');
    });

    it('with the current family without a baby, shows its name and ticks its "No baby yet"', async () => {
      await show([tom], null, [martins, durands], durands);

      expect(text('family-name')).toBe('Durands');
      expect(find('selected-name')).toBeNull();
      await openSwitcher();
      expect(grouped()).toEqual(['Martins > Tom false', `Durands > ${en.families.noBaby} true`]);
    });
  });
});
