import { TestBed } from '@angular/core/testing';
import en from '../../../../public/i18n/en.json';
import { PumpSyncService } from '../../core/pumps/pump-sync.service';
import { RUNNING_TIMER_SOURCES } from '../../core/timers/running-timer.models';
import { fakePumpSync } from '../../testing/pump-sync';
import { aPump } from '../../testing/pumps';
import { PumpTimerSource, providePumpTimers } from './pump-timers';

describe('PumpTimerSource', () => {
  let sync: ReturnType<typeof fakePumpSync>;
  let source: PumpTimerSource;

  beforeEach(() => {
    sync = fakePumpSync();
    TestBed.configureTestingModule({
      providers: [providePumpTimers(), { provide: PumpSyncService, useValue: sync }],
    });
    source = TestBed.inject(PumpTimerSource);
  });

  it('is registered as a running timer source', () => {
    expect(TestBed.inject(RUNNING_TIMER_SOURCES)).toContain(source);
  });

  it('has one timer per live session, opening it in the Pump sheet', () => {
    const pump = aPump({ id: 'p9', babyId: 'b2', endTime: null });
    sync.inProgress.set([pump]);

    expect(source.timers()).toHaveLength(1);
    expect(source.timers()[0]).toMatchObject({
      id: 'pump-p9',
      section: 'pump',
      kind: 'pump',
      entry: pump,
      babyId: 'b2',
    });
  });

  it('reads "Pumping" with the live duration from the stored start time', () => {
    sync.inProgress.set([aPump({ startTime: '2026-10-03T10:00:00Z', endTime: null })]);

    const [timer] = source.timers();

    expect(en.pump.timer.pumping).toBe('Pumping');
    expect(timer.label).toBe('pump.timer.pumping');
    expect(timer.seconds(Date.parse('2026-10-03T10:12:10Z'))).toBe(730);
  });

  it('has none for a stopped session', () => {
    sync.inProgress.set([aPump()]);

    expect(source.timers()).toEqual([]);
  });
});
