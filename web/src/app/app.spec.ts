import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { App } from './app';
import { SelectedBabyService } from './core/babies/selected-baby.service';
import { RUNNING_TIMER_SOURCES } from './core/timers/running-timer.models';
import { fakeTimer, fakeTimerSource } from './testing/fake-timer-source';
import { translocoTesting } from './testing/transloco-testing';
import { EntrySheetService } from './shared/ui/entry-sheet/entry-sheet.service';

describe('App', () => {
  const setup = async (running: boolean) => {
    const fake = fakeTimerSource(running ? [fakeTimer()] : []);
    await TestBed.configureTestingModule({
      imports: [App, translocoTesting()],
      providers: [
        provideRouter([]),
        { provide: RUNNING_TIMER_SOURCES, useValue: [fake.source] },
        { provide: SelectedBabyService, useValue: { babies: signal(null) } },
        { provide: EntrySheetService, useValue: { edit: () => of(undefined) } },
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

  it('shows the running timers bar on every screen while a timer runs', async () => {
    const host = await setup(true);
    expect(host.querySelector('router-outlet ~ nala-running-timers-bar')).not.toBeNull();
  });

  it("doesn't load the running timers bar while no timer runs", async () => {
    const host = await setup(false);
    expect(host.querySelector('nala-running-timers-bar')).toBeNull();
  });
});
