import { signal } from '@angular/core';

/** A stand-in for `OfflineQueueService`: the test bumps `sent` as if the queue had just been sent. */
export const fakeOfflineQueue = () => ({ sent: signal(0), pending: signal(0) });
