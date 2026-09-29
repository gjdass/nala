import { TestBed } from '@angular/core/testing';
import { fakeTimer, fakeTimerSource } from '../../testing/fake-timer-source';
import { RUNNING_TIMER_SOURCES, RunningTimerSource } from './running-timer.models';
import { RunningTimersService } from './running-timers.service';

describe('RunningTimersService', () => {
  const setup = (sources: RunningTimerSource[]) => {
    TestBed.configureTestingModule({
      providers: [{ provide: RUNNING_TIMER_SOURCES, useValue: sources }],
    });
    return TestBed.inject(RunningTimersService);
  };

  it('is empty without sources', () => {
    TestBed.configureTestingModule({});

    expect(TestBed.inject(RunningTimersService).timers()).toEqual([]);
  });

  it('merges the timers of every source, in registration order', () => {
    const a = fakeTimer({ id: 'a' });
    const b = fakeTimer({ id: 'b' });
    const c = fakeTimer({ id: 'c' });

    const service = setup([fakeTimerSource([a, b]).source, fakeTimerSource([c]).source]);

    expect(service.timers()).toEqual([a, b, c]);
  });

  it('follows a source starting and stopping timers', () => {
    const fake = fakeTimerSource();
    const service = setup([fake.source]);
    const timer = fakeTimer();

    fake.set([timer]);
    expect(service.timers()).toEqual([timer]);

    fake.set([]);
    expect(service.timers()).toEqual([]);
  });
});
