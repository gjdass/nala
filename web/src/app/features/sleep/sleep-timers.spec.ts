import { TestBed } from '@angular/core/testing';
import en from '../../../../public/i18n/en.json';
import { SleepSyncService } from '../../core/sleeps/sleep-sync.service';
import { RUNNING_TIMER_SOURCES } from '../../core/timers/running-timer.models';
import { fakeSleepSync } from '../../testing/sleep-sync';
import { aSleep } from '../../testing/sleeps';
import { SleepTimerSource, provideSleepTimers } from './sleep-timers';

describe('SleepTimerSource', () => {
  let sync: ReturnType<typeof fakeSleepSync>;
  let source: SleepTimerSource;

  beforeEach(() => {
    sync = fakeSleepSync();
    TestBed.configureTestingModule({
      providers: [provideSleepTimers(), { provide: SleepSyncService, useValue: sync }],
    });
    source = TestBed.inject(SleepTimerSource);
  });

  it('is registered as a running timer source', () => {
    expect(TestBed.inject(RUNNING_TIMER_SOURCES)).toContain(source);
  });

  it('has one timer per live sleep, opening it in the Sleep sheet', () => {
    const sleep = aSleep({ id: 's9', babyId: 'b2', endTime: null });
    sync.inProgress.set([sleep]);

    expect(source.timers()).toHaveLength(1);
    expect(source.timers()[0]).toMatchObject({
      id: 'sleep-s9',
      section: 'sleep',
      kind: 'sleep',
      entry: sleep,
      babyId: 'b2',
    });
  });

  it('reads "Sleeping" with the live duration from the stored start time', () => {
    sync.inProgress.set([aSleep({ startTime: '2026-09-30T10:00:00Z', endTime: null })]);

    const [timer] = source.timers();

    expect(en.sleep.timer.sleeping).toBe('Sleeping');
    expect(timer.label).toBe('sleep.timer.sleeping');
    expect(timer.seconds(Date.parse('2026-09-30T10:45:10Z'))).toBe(2710);
  });

  it('has none for a stopped sleep', () => {
    sync.inProgress.set([aSleep()]);

    expect(source.timers()).toEqual([]);
  });
});
