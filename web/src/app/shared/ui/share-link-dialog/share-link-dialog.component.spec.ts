import { Clipboard } from '@angular/cdk/clipboard';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import en from '../../../../../public/i18n/en.json';
import { translocoTesting } from '../../../testing/transloco-testing';
import { ShareLinkDialogComponent, ShareLinkDialogData } from './share-link-dialog.component';

describe('ShareLinkDialogComponent', () => {
  let fixture: ComponentFixture<ShareLinkDialogComponent>;
  let clipboard: { copy: ReturnType<typeof vi.fn> };
  let snackBar: { open: ReturnType<typeof vi.fn> };
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  const data: ShareLinkDialogData = {
    title: 'Reset link for Ben',
    text: 'Send this link to Ben.',
    url: 'https://nala.example/reset/a-b_c',
  };

  const host = () => fixture.nativeElement as HTMLElement;
  const button = (id: string) => host().querySelector<HTMLButtonElement>(`[data-testid="${id}"]`);
  const click = async (id: string) => {
    button(id)!.click();
    await fixture.whenStable();
  };

  const render = async () => {
    fixture = TestBed.createComponent(ShareLinkDialogComponent);
    await fixture.whenStable();
  };

  beforeEach(async () => {
    clipboard = { copy: vi.fn(() => true) };
    snackBar = { open: vi.fn() };
    dialogRef = { close: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [ShareLinkDialogComponent, translocoTesting()],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: Clipboard, useValue: clipboard },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    delete (navigator as { share?: unknown }).share;
  });

  it('shows the title, the text and the link, read-only', async () => {
    await render();

    expect(host().querySelector('[mat-dialog-title]')?.textContent?.trim()).toBe(data.title);
    expect(host().textContent).toContain(data.text);
    const link = host().querySelector<HTMLInputElement>('input[data-testid="link"]')!;
    expect(link.value).toBe(data.url);
    expect(link.readOnly).toBe(true);
  });

  it('copies the link and confirms with a snackbar', async () => {
    await render();
    await click('copy');

    expect(clipboard.copy).toHaveBeenCalledWith(data.url);
    expect(snackBar.open).toHaveBeenCalledWith(en.shareLink.copied, undefined, { duration: 3000 });
  });

  it('says so when the link cannot be copied', async () => {
    clipboard.copy.mockReturnValue(false);
    await render();
    await click('copy');

    expect(snackBar.open).toHaveBeenCalledWith(en.shareLink.copyFailed, undefined, {
      duration: 3000,
    });
  });

  it('has no Share button when the device cannot share', async () => {
    await render();

    expect(button('share')).toBeNull();
  });

  it("opens the device's share sheet with the link", async () => {
    const share = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    await render();
    await click('share');

    expect(button('share')?.textContent?.trim()).toBe(en.shareLink.share);
    expect(share).toHaveBeenCalledWith({ title: data.title, url: data.url });
  });

  it('ignores a cancelled share', async () => {
    const share = vi.fn(() => Promise.reject(new DOMException('Cancelled', 'AbortError')));
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    await render();
    await click('share');

    expect(snackBar.open).not.toHaveBeenCalled();
  });

  it('closes', async () => {
    await render();
    await click('close');

    expect(button('close')?.textContent?.trim()).toBe(en.shareLink.close);
    expect(dialogRef.close).toHaveBeenCalled();
  });
});
