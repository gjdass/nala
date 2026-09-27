import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { translocoTesting } from '../../testing/transloco-testing';
import { CurrentUser } from '../auth/auth.models';
import { AuthService } from '../auth/auth.service';
import { provideUserLanguage } from './user-language';

describe('provideUserLanguage', () => {
  let auth: AuthService;
  let transloco: TranslocoService;

  const user = (language: CurrentUser['language']): CurrentUser => ({
    id: 'u1',
    email: 'anna@mail.com',
    displayName: 'Anna',
    language,
    isAdmin: false,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideUserLanguage()],
    });
    auth = TestBed.inject(AuthService);
    transloco = TestBed.inject(TranslocoService);
    TestBed.tick();
  });

  it('leaves the language alone while nobody is signed in', () => {
    auth.state.set({ setupRequired: false, user: null });
    TestBed.tick();

    expect(transloco.getActiveLang()).toBe('en');
  });

  it("switches to the signed-in user's language", () => {
    auth.state.set({ setupRequired: false, user: user('fr') });
    TestBed.tick();

    expect(transloco.getActiveLang()).toBe('fr');
  });

  it("follows a change of the user's language", () => {
    auth.state.set({ setupRequired: false, user: user('fr') });
    TestBed.tick();
    auth.state.set({ setupRequired: false, user: user('en') });
    TestBed.tick();

    expect(transloco.getActiveLang()).toBe('en');
  });
});
