import { signal } from '@angular/core';

/** A stand-in for `DataRefreshService`: the test bumps `reload` as if the sections should reload. */
export const fakeDataRefresh = () => ({ reload: signal(0) });
