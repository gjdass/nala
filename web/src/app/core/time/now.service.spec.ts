import { TestBed } from '@angular/core/testing';
import { NowService } from './now.service';

describe('NowService', () => {
  const start = new Date(2026, 8, 28, 9, 0, 0).getTime();

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(start);
  });

  afterEach(() => vi.useRealTimers());

  it('starts at the current time', () => {
    expect(TestBed.inject(NowService).now()).toBe(start);
  });

  it('advances every second', () => {
    const now = TestBed.inject(NowService);

    vi.advanceTimersByTime(1000);
    expect(now.now()).toBe(start + 1000);

    vi.advanceTimersByTime(59_000);
    expect(now.now()).toBe(start + 60_000);
  });

  it('stops ticking once destroyed', () => {
    const now = TestBed.inject(NowService);

    TestBed.resetTestingModule();
    vi.advanceTimersByTime(5000);

    expect(now.now()).toBe(start);
  });
});
