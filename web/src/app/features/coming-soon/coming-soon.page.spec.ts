import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import en from '../../../../public/i18n/en.json';
import { Baby } from '../../core/babies/baby.models';
import { BabyService } from '../../core/babies/baby.service';
import { translocoTesting } from '../../testing/transloco-testing';
import { ComingSoonPage } from './coming-soon.page';

describe('ComingSoonPage', () => {
  let harness: RouterTestingHarness;
  let list: ReturnType<typeof vi.fn>;

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
  const text = (testId: string) =>
    host().querySelector(`[data-testid="${testId}"]`)?.textContent?.trim();

  beforeEach(async () => {
    localStorage.clear();
    list = vi.fn(() => of({ ok: true, babies: [lea] }));
    await TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [
        provideRouter([
          { path: 'history', component: ComingSoonPage, data: { destination: 'history' } },
          { path: 'trends', component: ComingSoonPage, data: { destination: 'trends' } },
        ]),
        { provide: BabyService, useValue: { list } },
      ],
    }).compileComponents();
    harness = await RouterTestingHarness.create();
  });

  it.each([
    ['history', en.nav.history],
    ['trends', en.nav.trends],
  ])('/%s shows the top app bar with the selected baby and a "Coming soon" empty state', async (path, title) => {
    await harness.navigateByUrl(`/${path}`, ComingSoonPage);
    await harness.fixture.whenStable();

    expect(list).toHaveBeenCalled();
    expect(host().querySelector('nala-top-app-bar')).not.toBeNull();
    expect(text('selected-name')).toBe('Lea');
    expect(text('destination-title')).toBe(title);
    expect(text('empty-title')).toBe(en.comingSoon.title);
    expect(text('empty-text')).toBe(en.comingSoon.text);
  });
});
