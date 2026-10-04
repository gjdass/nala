import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { App } from './app';
import { AuthState } from './core/auth/auth.models';
import { AuthService } from './core/auth/auth.service';
import { SelectedBabyService } from './core/babies/selected-baby.service';
import { RUNNING_TIMER_SOURCES } from './core/timers/running-timer.models';
import { fakeTimer, fakeTimerSource } from './testing/fake-timer-source';
import { translocoTesting } from './testing/transloco-testing';
import { EntrySheetService } from './shared/ui/entry-sheet/entry-sheet.service';

describe('App', () => {
  const signedIn: AuthState = {
    setupRequired: false,
    smtpEnabled: false,
    user: { id: 'u1', email: 'anna@mail.com', displayName: 'Anna', language: 'en', isAdmin: true },
  };
  const signedOut: AuthState = { setupRequired: false, smtpEnabled: false, user: null };

  const setup = async (running: boolean, auth: AuthState | null = signedIn) => {
    const fake = fakeTimerSource(running ? [fakeTimer()] : []);
    await TestBed.configureTestingModule({
      imports: [App, translocoTesting()],
      providers: [
        provideRouter([]),
        { provide: RUNNING_TIMER_SOURCES, useValue: [fake.source] },
        { provide: SelectedBabyService, useValue: { babies: signal(null) } },
        { provide: EntrySheetService, useValue: { edit: () => of(undefined) } },
        { provide: AuthService, useValue: { state: signal(auth) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('renders the router outlet', async () => {
    const host = await setup(false);
    expect(host.querySelector('router-outlet')).not.toBeNull();
  });

  it('holds the edge guard on every screen, signed in or not, hidden from assistive technology', async () => {
    for (const auth of [signedIn, signedOut]) {
      TestBed.resetTestingModule();
      const guard = (await setup(false, auth)).querySelector('.nala-edge-guard');
      expect(guard).not.toBeNull();
      expect(guard!.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('shows the running timers bar on every screen while a timer runs', async () => {
    const host = await setup(true);
    expect(host.querySelector('router-outlet ~ .dock nala-running-timers-bar')).not.toBeNull();
  });

  it("doesn't load the running timers bar while no timer runs", async () => {
    const host = await setup(false);
    expect(host.querySelector('nala-running-timers-bar')).toBeNull();
  });

  it('shows the bottom navigation bar on signed-in screens', async () => {
    const host = await setup(false);
    expect(host.querySelector('router-outlet ~ .dock > nala-bottom-nav')).not.toBeNull();
  });

  it("doesn't show the bottom navigation bar on signed-out screens", async () => {
    expect((await setup(false, signedOut)).querySelector('nala-bottom-nav')).toBeNull();
    TestBed.resetTestingModule();
    expect((await setup(false, null)).querySelector('nala-bottom-nav')).toBeNull();
  });

  it('shows the running timers inside the bottom navigation bar, marking it as holding timers', async () => {
    const host = await setup(true);
    expect(host.querySelector('.dock > nala-bottom-nav nala-running-timers-bar')).not.toBeNull();
    expect(host.querySelector('.dock > nala-running-timers-bar')).toBeNull();
    expect(host.querySelector('[data-testid="nav-pill"]')?.classList).toContain('with-timers');
  });

  it("doesn't mark the bottom navigation bar as holding timers while none runs", async () => {
    const host = await setup(false);
    expect(host.querySelector('[data-testid="nav-pill"]')?.classList).not.toContain('with-timers');
  });
});
