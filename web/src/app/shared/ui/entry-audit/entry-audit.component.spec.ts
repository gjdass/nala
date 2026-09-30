import { ComponentFixture, TestBed } from '@angular/core/testing';
import { translocoTesting } from '../../../testing/transloco-testing';
import { EntryAuditComponent } from './entry-audit.component';

describe('EntryAuditComponent', () => {
  let fixture: ComponentFixture<EntryAuditComponent>;

  const text = () =>
    (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ').trim();
  const shortTime = (iso: string) =>
    new Intl.DateTimeFormat('en', { timeStyle: 'short' }).format(new Date(iso));

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 30, 18, 0));
    await TestBed.configureTestingModule({
      imports: [EntryAuditComponent, translocoTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(EntryAuditComponent);
    fixture.componentRef.setInput('loggedBy', 'Anna');
  });

  afterEach(() => vi.useRealTimers());

  it('says who logged the entry', async () => {
    await fixture.whenStable();

    expect(text()).toBe('Logged by Anna');
  });

  it('adds who edited it last, and when', async () => {
    const at = new Date(2026, 8, 30, 14, 40).toISOString();
    fixture.componentRef.setInput('editedBy', 'Ben');
    fixture.componentRef.setInput('editedAt', at);
    await fixture.whenStable();

    expect(text()).toBe(`Logged by Anna · Edited by Ben, ${shortTime(at)}`);
  });
});
