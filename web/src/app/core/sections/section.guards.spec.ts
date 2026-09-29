import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { fakeSection } from '../../testing/fake-section';
import { registeredSectionGuard } from './section.guards';
import { SECTIONS } from './section.models';

describe('registeredSectionGuard', () => {
  const run = (section: string) =>
    TestBed.runInInjectionContext(() =>
      registeredSectionGuard(
        { paramMap: convertToParamMap({ section }) } as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
      ),
    );
  const url = (result: unknown) => TestBed.inject(Router).serializeUrl(result as UrlTree);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: SECTIONS, useValue: [fakeSection('feed')] }],
    });
  });

  it('lets a registered section through', () => {
    expect(run('feed')).toBe(true);
  });

  it('sends an unknown key to home', () => {
    const result = run('nope');
    expect(result).toBeInstanceOf(UrlTree);
    expect(url(result)).toBe('/');
  });

  it('sends a known but not yet built section to home', () => {
    const result = run('pump');
    expect(result).toBeInstanceOf(UrlTree);
    expect(url(result)).toBe('/');
  });
});
