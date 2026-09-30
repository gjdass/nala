import { ComponentFixture, TestBed } from '@angular/core/testing';
import en from '../../../../../public/i18n/en.json';
import { translocoTesting } from '../../../testing/transloco-testing';
import { SplitSide, SplitTimerComponent } from './split-timer.component';

describe('SplitTimerComponent', () => {
  let fixture: ComponentFixture<SplitTimerComponent>;
  let started: SplitSide[];
  let stopped: SplitSide[];
  let edited: SplitSide[];

  const host = () => fixture.nativeElement as HTMLElement;
  const find = <T extends HTMLElement = HTMLElement>(testId: string) =>
    host().querySelector<T>(`[data-testid="${testId}"]`);
  const text = (testId: string) => find(testId)?.textContent?.replace(/\s+/g, ' ').trim();
  const toggle = (side: SplitSide) => find<HTMLButtonElement>(`split-${side}-toggle`)!;
  const set = async (inputs: Record<string, unknown>) => {
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SplitTimerComponent, translocoTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(SplitTimerComponent);
    started = [];
    stopped = [];
    edited = [];
    fixture.componentInstance.edit.subscribe((side) => edited.push(side));
    fixture.componentInstance.start.subscribe((side) => started.push(side));
    fixture.componentInstance.stop.subscribe((side) => stopped.push(side));
    await set({ leftSeconds: 305, rightSeconds: 0 });
  });

  it('shows the left and right timers side by side, each with its own duration', () => {
    const left = find('split-left')!;
    const right = find('split-right')!;

    expect(left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(left.contains(right)).toBe(false);
    expect(text('split-left-label')).toBe(en.splitTimer.left);
    expect(text('split-right-label')).toBe(en.splitTimer.right);
    expect(text('split-left-duration')).toBe('5m 5s');
    expect(text('split-right-duration')).toBe('0s');
  });

  it('offers Start Left and Start Right as tonal buttons while no side runs', () => {
    expect(toggle('left').textContent?.trim()).toBe(en.splitTimer.startLeft);
    expect(toggle('right').textContent?.trim()).toBe(en.splitTimer.startRight);
    expect(toggle('left').classList).toContain('mat-tonal-button');
    expect(toggle('right').classList).toContain('mat-tonal-button');
  });

  it('turns the running side into a filled Stop button', async () => {
    await set({ running: 'left' });

    expect(toggle('left').textContent?.trim()).toBe(en.splitTimer.stop);
    expect(toggle('left').classList).toContain('mat-mdc-unelevated-button');
    expect(toggle('left').classList).not.toContain('mat-tonal-button');
    expect(toggle('left').getAttribute('aria-pressed')).toBe('true');
    expect(toggle('right').textContent?.trim()).toBe(en.splitTimer.startRight);
    expect(toggle('right').classList).toContain('mat-tonal-button');
  });

  it('emits start with the tapped side', async () => {
    toggle('right').click();
    await set({ running: 'left' });
    toggle('right').click();

    expect(started).toEqual(['right', 'right']);
    expect(stopped).toEqual([]);
  });

  it('emits stop when the running side is tapped', async () => {
    await set({ running: 'left' });

    toggle('left').click();

    expect(stopped).toEqual(['left']);
    expect(started).toEqual([]);
  });

  it('labels the marked side above its timer only', async () => {
    expect(find('split-left-mark')).toBeNull();
    expect(find('split-right-mark')).toBeNull();

    await set({ markedSide: 'right', markLabel: 'last side' });

    expect(text('split-right-mark')).toBe('last side');
    expect(find('split-left-mark')).toBeNull();
    const mark = find('split-right-mark')!;
    expect(
      mark.compareDocumentPosition(find('split-right-duration')!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('disables both buttons while disabled', async () => {
    await set({ disabled: true });

    expect(toggle('left').disabled).toBe(true);
    expect(toggle('right').disabled).toBe(true);
  });

  it('has no pencils unless editable', () => {
    expect(find('split-left-edit')).toBeNull();
    expect(find('split-right-edit')).toBeNull();
  });

  it('offers a pencil under each duration that emits its side', async () => {
    await set({ editable: true });

    const left = find<HTMLButtonElement>('split-left-edit')!;
    const right = find<HTMLButtonElement>('split-right-edit')!;
    expect(left.getAttribute('aria-label')).toBe(en.splitTimer.editLeft);
    expect(right.getAttribute('aria-label')).toBe(en.splitTimer.editRight);
    expect(left.textContent?.trim()).toBe('edit');
    expect(
      find('split-left-duration')!.compareDocumentPosition(left) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    right.click();
    left.click();

    expect(edited).toEqual(['right', 'left']);
    expect(started).toEqual([]);
  });

  it('disables only Start and Stop while the timers are disabled', async () => {
    await set({ editable: true, timersDisabled: true });

    expect(toggle('left').disabled).toBe(true);
    expect(toggle('right').disabled).toBe(true);
    expect(find<HTMLButtonElement>('split-left-edit')!.disabled).toBe(false);
    expect(find<HTMLButtonElement>('split-right-edit')!.disabled).toBe(false);
  });

  it('disables the pencils too while disabled', async () => {
    await set({ editable: true, disabled: true });

    expect(find<HTMLButtonElement>('split-left-edit')!.disabled).toBe(true);
  });
});
