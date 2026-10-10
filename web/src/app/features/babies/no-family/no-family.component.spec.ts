import { ComponentFixture, TestBed } from '@angular/core/testing';
import en from '../../../../../public/i18n/en.json';
import { translocoTesting } from '../../../testing/transloco-testing';
import { NoFamilyComponent } from './no-family.component';

describe('NoFamilyComponent', () => {
  let fixture: ComponentFixture<NoFamilyComponent>;

  const host = () => fixture.nativeElement as HTMLElement;
  const text = (testId: string) =>
    host().querySelector(`[data-testid="${testId}"]`)?.textContent?.trim();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NoFamilyComponent, translocoTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(NoFamilyComponent);
    await fixture.whenStable();
  });

  it('asks to be invited into a family, with no action', () => {
    expect(text('empty-title')).toBe(en.families.none.title);
    expect(text('empty-text')).toBe(en.families.none.text);
    expect(host().querySelector('button, a')).toBeNull();
  });
});
