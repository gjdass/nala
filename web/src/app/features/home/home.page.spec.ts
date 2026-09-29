import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import en from '../../../../public/i18n/en.json';
import { BabiesResult, Baby, BabySheetResult } from '../../core/babies/baby.models';
import { BabyService } from '../../core/babies/baby.service';
import { HealthService, HealthStatus } from '../../core/health/health.service';
import { SheetService } from '../../shared/ui/sheet/sheet.service';
import { translocoTesting } from '../../testing/transloco-testing';
import { BabySheetComponent } from '../babies/baby-sheet/baby-sheet.component';
import { HomePage } from './home.page';

describe('HomePage', () => {
  let fixture: ComponentFixture<HomePage>;
  let health: Subject<HealthStatus>;
  let babiesLoaded: Subject<BabiesResult>;
  let sheetClosed: Subject<BabySheetResult | undefined>;
  let sheet: { open: ReturnType<typeof vi.fn> };

  const lea: Baby = {
    id: 'b1',
    name: 'Lea',
    birthDate: '2026-09-01',
    sex: 'girl',
    birthWeightG: null,
    birthLengthCm: null,
    birthHeadCircumferenceCm: null,
  };
  const tom: Baby = { ...lea, id: 'b0', name: 'Tom', birthDate: '2026-05-18', sex: 'boy' };

  const host = () => fixture.nativeElement as HTMLElement;
  const find = (testId: string) => host().querySelector(`[data-testid="${testId}"]`);
  const text = (testId: string) => find(testId)?.textContent?.trim();
  const load = async (result: BabiesResult) => {
    babiesLoaded.next(result);
    await fixture.whenStable();
  };

  beforeEach(async () => {
    localStorage.clear();
    health = new Subject<HealthStatus>();
    babiesLoaded = new Subject<BabiesResult>();
    sheetClosed = new Subject<BabySheetResult | undefined>();
    sheet = { open: vi.fn(() => sheetClosed) };
    await TestBed.configureTestingModule({
      imports: [HomePage, translocoTesting()],
      providers: [
        provideRouter([]),
        { provide: HealthService, useValue: { check: () => health } },
        { provide: BabyService, useValue: { list: () => babiesLoaded } },
        { provide: SheetService, useValue: sheet },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HomePage);
    await fixture.whenStable();
  });

  it('shows the top bar with the settings button, whatever the babies', () => {
    const link = host().querySelector('nala-top-app-bar a[data-testid="settings"]');
    expect(link?.getAttribute('href')).toBe('/settings');
  });

  it('shows neither the empty state nor the app content while the babies load', () => {
    expect(find('empty-state')).toBeNull();
    expect(find('home-content')).toBeNull();
  });

  describe('without any baby', () => {
    beforeEach(() => load({ ok: true, babies: [] }));

    it('shows only the empty state inviting to add a baby', () => {
      expect(text('empty-title')).toBe(en.babies.empty.title);
      expect(text('empty-text')).toBe(en.babies.empty.text);
      expect(text('add-baby')).toBe(en.babies.empty.add);
      expect(find('home-content')).toBeNull();
    });

    it('opens the baby sheet from the empty state', async () => {
      (find('add-baby') as HTMLButtonElement).click();
      await fixture.whenStable();

      expect(sheet.open).toHaveBeenCalledWith(BabySheetComponent);
    });

    it('leaves the empty state once a baby is added', async () => {
      (find('add-baby') as HTMLButtonElement).click();
      sheetClosed.next({ saved: lea });
      await fixture.whenStable();

      expect(find('empty-state')).toBeNull();
      expect(find('home-content')).toBeTruthy();
      expect(text('selected-name')).toBe('Lea');
    });

    it('stays on the empty state when the sheet is closed without saving', async () => {
      (find('add-baby') as HTMLButtonElement).click();
      sheetClosed.next(undefined);
      await fixture.whenStable();

      expect(find('empty-state')).toBeTruthy();
    });
  });

  describe('with a baby', () => {
    beforeEach(() => load({ ok: true, babies: [lea] }));

    it('shows the app content, no empty state', () => {
      expect(find('empty-state')).toBeNull();
      expect(find('home-content')).toBeTruthy();
    });

    it('shows the API status', async () => {
      expect(text('health-status')).toBe(en.health.loading);
      health.next('ok');
      await fixture.whenStable();
      expect(text('health-status')).toBe(en.health.ok);
    });

    it('shows the selected baby in the top bar, without a switcher', () => {
      expect(text('selected-name')).toBe('Lea');
      expect(find('baby-switcher')).toBeNull();
    });
  });

  describe('with several babies', () => {
    it('selects the first baby when none is stored', async () => {
      await load({ ok: true, babies: [tom, lea] });

      expect(text('selected-name')).toBe('Tom');
      expect(find('baby-switcher')).toBeTruthy();
    });

    it('restores the selected baby from nala.baby', async () => {
      localStorage.setItem('nala.baby', lea.id);
      await load({ ok: true, babies: [tom, lea] });

      expect(text('selected-name')).toBe('Lea');
    });

    it('switching baby from the bar updates the bar and stores the choice', async () => {
      await load({ ok: true, babies: [tom, lea] });

      (find('baby-switcher') as HTMLButtonElement).click();
      await fixture.whenStable();
      const items = document.querySelectorAll<HTMLButtonElement>('[data-testid="switcher-item"]');
      items[1].click();
      await fixture.whenStable();

      expect(text('selected-name')).toBe('Lea');
      expect(localStorage.getItem('nala.baby')).toBe(lea.id);
    });
  });

  it('says when the babies cannot be loaded', async () => {
    await load({ ok: false, errors: { form: 'unknown' } });

    expect(text('babies-error')).toBe(en.babies.loadError);
    expect(find('empty-state')).toBeNull();
    expect(find('home-content')).toBeNull();
  });
});
