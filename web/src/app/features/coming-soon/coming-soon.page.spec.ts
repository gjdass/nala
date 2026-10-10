import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import en from '../../../../public/i18n/en.json';
import { Baby } from '../../core/babies/baby.models';
import { BabyService } from '../../core/babies/baby.service';
import { FamiliesResult } from '../../core/families/family.models';
import { FamilyService } from '../../core/families/family.service';
import { translocoTesting } from '../../testing/transloco-testing';
import { ComingSoonPage } from './coming-soon.page';

describe('ComingSoonPage', () => {
  let harness: RouterTestingHarness;
  let list: ReturnType<typeof vi.fn>;
  let families: FamiliesResult;

  const lea: Baby = {
    id: 'b1',
    familyId: 'f1',
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
    families = { ok: true, families: [{ id: 'f1', name: 'Martins', isAdmin: true }] };
    await TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [
        provideRouter([
          { path: 'history', component: ComingSoonPage, data: { destination: 'history' } },
          { path: 'trends', component: ComingSoonPage, data: { destination: 'trends' } },
        ]),
        { provide: BabyService, useValue: { list } },
        { provide: FamilyService, useValue: { list: () => of(families) } },
      ],
    }).compileComponents();
    harness = await RouterTestingHarness.create();
  });

  it.each([
    ['history', en.nav.history],
    ['trends', en.nav.trends],
  ])(
    '/%s shows the top app bar with the selected baby and a "Coming soon" empty state',
    async (path, title) => {
      await harness.navigateByUrl(`/${path}`, ComingSoonPage);
      await harness.fixture.whenStable();

      expect(list).toHaveBeenCalled();
      expect(host().querySelector('nala-top-app-bar')).not.toBeNull();
      expect(text('selected-name')).toBe('Lea');
      expect(text('destination-title')).toBe(title);
      expect(text('empty-title')).toBe(en.comingSoon.title);
      expect(text('empty-text')).toBe(en.comingSoon.text);
    },
  );

  it('/trends shows the no-family empty state instead of "Coming soon" for a user in no family', async () => {
    families = { ok: true, families: [] };
    list.mockReturnValue(of({ ok: true, babies: [] }));

    await harness.navigateByUrl('/trends', ComingSoonPage);
    await harness.fixture.whenStable();

    expect(text('empty-title')).toBe(en.families.none.title);
    expect(text('empty-text')).toBe(en.families.none.text);
    expect(host().querySelector('[data-testid="empty-state"] button')).toBeNull();
    expect(text('selected-name')).toBeUndefined();
  });
});
