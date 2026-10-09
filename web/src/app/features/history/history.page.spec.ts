import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslocoService } from '@jsverse/transloco';
import { Subject } from 'rxjs';
import en from '../../../../public/i18n/en.json';
import { BabiesResult, Baby } from '../../core/babies/baby.models';
import { BabyService } from '../../core/babies/baby.service';
import { DataRefreshService } from '../../core/refresh/data-refresh.service';
import { SECTIONS } from '../../core/sections/section.models';
import { fakeDataRefresh } from '../../testing/data-refresh';
import { fakeSection } from '../../testing/fake-section';
import { translocoTesting } from '../../testing/transloco-testing';
import { HistoryPage } from './history.page';

@Component({
  selector: 'nala-fake-feed-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p data-testid="section-history">feed history</p>`,
})
class FakeFeedHistory {}

@Component({ template: '' })
class Empty {}

describe('HistoryPage', () => {
  let harness: RouterTestingHarness;
  let babiesLoaded: Subject<BabiesResult>;
  let list: ReturnType<typeof vi.fn>;
  let refresh: ReturnType<typeof fakeDataRefresh>;

  const lea: Baby = {
    id: 'b1',
    name: 'Lea',
    birthDate: '2026-09-01',
    sex: 'girl',
    birthWeightG: null,
    birthLengthCm: null,
    birthHeadCircumferenceCm: null,
  };

  const host = () => harness.routeNativeElement as HTMLElement;
  const find = (testId: string) => host().querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const text = (testId: string) => find(testId)?.textContent?.trim();
  const load = async (result: BabiesResult) => {
    babiesLoaded.next(result);
    await harness.fixture.whenStable();
  };

  beforeEach(async () => {
    localStorage.clear();
    babiesLoaded = new Subject<BabiesResult>();
    list = vi.fn(() => babiesLoaded);
    refresh = fakeDataRefresh();
    await TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [
        provideRouter([
          { path: 'history/:section', component: HistoryPage },
          { path: '', component: Empty },
        ]),
        {
          provide: SECTIONS,
          useValue: [
            {
              ...fakeSection('feed', 'restaurant'),
              loadHistory: () => Promise.resolve(FakeFeedHistory),
            },
          ],
        },
        { provide: BabyService, useValue: { list } },
        { provide: DataRefreshService, useValue: refresh },
      ],
    }).compileComponents();
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/history/feed', HistoryPage);
  });

  it('reloads the babies on the reload signal', async () => {
    await load({ ok: true, babies: [lea] });
    list.mockClear();

    refresh.reload.set(1);
    await harness.fixture.whenStable();

    expect(list).toHaveBeenCalledTimes(1);
  });

  it("uses the section's colour scheme for the whole page", () => {
    expect(host().classList).toContain('nala-scheme-feed');
  });

  it('loads the babies', () => {
    expect(list).toHaveBeenCalled();
  });

  it('shows nothing of the section until the babies are loaded', () => {
    expect(find('section-history')).toBeNull();
  });

  describe('with a baby', () => {
    beforeEach(() => load({ ok: true, babies: [lea] }));

    it("renders the section's own history", () => {
      expect(text('section-history')).toBe('feed history');
    });

    it('titles the page with the section and the selected baby', () => {
      expect(text('history-title')).toBe('Feed history');
      expect(text('history-baby')).toBe('Lea');
    });

    it('has a labelled back button to home', () => {
      const back = find('back')!;
      expect(back.getAttribute('href')).toBe('/');
      expect(back.getAttribute('aria-label')).toBe(en.history.back);
    });

    it('is translated', async () => {
      TestBed.inject(TranslocoService).setActiveLang('fr');
      await harness.fixture.whenStable();

      expect(text('history-title')).toBe('Historique : Repas');
    });
  });

  it('goes back home when the family has no baby', async () => {
    await load({ ok: true, babies: [] });

    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('shows an error when the babies cannot be loaded', async () => {
    await load({ ok: false, errors: {} });

    expect(text('babies-error')).toBe(en.babies.loadError);
    expect(find('section-history')).toBeNull();
  });
});
