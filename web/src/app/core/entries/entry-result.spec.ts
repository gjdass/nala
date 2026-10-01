import { HttpErrorResponse } from '@angular/common/http';
import { toDeleteResult, toEntryResult } from './entry-result';

describe('entry results', () => {
  const refused = new HttpErrorResponse({
    status: 400,
    error: { errors: { endTime: ['beforeStart'] } },
  });

  it('maps a sent entry to a saved result with the entry', () => {
    expect(toEntryResult({ sent: { id: 's1' } })).toEqual({ ok: true, entry: { id: 's1' } });
  });

  it('maps a request kept on the device to a queued result', () => {
    expect(toEntryResult({ queued: true })).toEqual({ ok: true, queued: true });
    expect(toDeleteResult({ queued: true })).toEqual({ ok: true, queued: true });
  });

  it('maps a refused request to its field errors', () => {
    expect(toEntryResult({ error: refused })).toEqual({
      ok: false,
      errors: { endTime: 'beforeStart' },
    });
  });

  it('maps a sent delete to done', () => {
    expect(toDeleteResult({ sent: undefined })).toEqual({ ok: true });
    expect(toDeleteResult({ error: refused })).toEqual({
      ok: false,
      errors: { endTime: 'beforeStart' },
    });
  });
});
