import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { SendInvitationResult } from '../../../core/invitations/invitation.models';
import { InvitationService } from '../../../core/invitations/invitation.service';
import { translocoTesting } from '../../../testing/transloco-testing';
import { InviteEmailDialogComponent } from './invite-email-dialog.component';

describe('InviteEmailDialogComponent', () => {
  let fixture: ComponentFixture<InviteEmailDialogComponent>;
  let sent: Subject<SendInvitationResult>;
  let invitations: { sendByEmail: ReturnType<typeof vi.fn> };
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  const host = () => fixture.nativeElement as HTMLElement;
  const email = () => host().querySelector<HTMLInputElement>('input[data-testid="email"]')!;
  const button = (testId: string) =>
    host().querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)!;
  const error = () => host().querySelector('[data-testid="error-email"]')?.textContent?.trim();
  const formError = () => host().querySelector('[data-testid="form-error"]')?.textContent?.trim();
  const type = (value: string) => {
    email().value = value;
    email().dispatchEvent(new Event('input'));
    email().dispatchEvent(new Event('blur'));
  };
  const click = async (element: HTMLElement) => {
    element.click();
    await fixture.whenStable();
  };
  const answer = async (value: SendInvitationResult) => {
    sent.next(value);
    await fixture.whenStable();
  };

  beforeEach(async () => {
    sent = new Subject<SendInvitationResult>();
    invitations = { sendByEmail: vi.fn(() => sent) };
    dialogRef = { close: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [InviteEmailDialogComponent, translocoTesting()],
      providers: [
        { provide: InvitationService, useValue: invitations },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { familyId: 'f1' } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(InviteEmailDialogComponent);
    await fixture.whenStable();
  });

  it('asks for the email address of the person to invite', () => {
    expect(host().textContent).toContain(en.invitations.emailDialog.title);
    expect(host().textContent).toContain(en.invitations.emailDialog.text);
    expect(email().type).toBe('email');
  });

  it.each([
    ['', 'required'],
    ['ben@mail', 'invalid'],
  ] as const)('refuses %j before sending (%s)', async (value, code) => {
    type(value);
    await click(button('send'));

    expect(error()).toBe(en.auth.errors.email[code]);
    expect(invitations.sendByEmail).not.toHaveBeenCalled();
  });

  it('sends the trimmed email to the family and closes with it', async () => {
    type(' ben@mail.com ');
    await click(button('send'));

    expect(invitations.sendByEmail).toHaveBeenCalledWith('f1', 'ben@mail.com');
    expect(button('send').disabled).toBe(true);
    await answer({ ok: true, expiresAt: '2026-10-04T20:00:00Z' });
    expect(dialogRef.close).toHaveBeenCalledWith('ben@mail.com');
  });

  it('shows the email of a member of the family under the field and stays open', async () => {
    type('anna@mail.com');
    await click(button('send'));
    await answer({ ok: false, errors: { email: 'alreadyMember' } });

    expect(error()).toBe(en.auth.errors.email.alreadyMember);
    expect(button('send').disabled).toBe(false);
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('shows the generic error when offline and stays open', async () => {
    type('ben@mail.com');
    await click(button('send'));
    await answer({ ok: false, errors: { form: 'unknown' } });

    expect(formError()).toBe(en.auth.errors.form.unknown);
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('closes with nothing on Cancel', async () => {
    await click(button('cancel'));

    expect(dialogRef.close).toHaveBeenCalledWith();
    expect(invitations.sendByEmail).not.toHaveBeenCalled();
  });
});
