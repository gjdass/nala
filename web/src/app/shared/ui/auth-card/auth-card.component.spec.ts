import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthCardComponent } from './auth-card.component';

@Component({
  imports: [AuthCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nala-auth-card title="Welcome" subtitle="Create the admin account">
      <p data-testid="body">Fields</p>
      <button authCardActions data-testid="action">Go</button>
    </nala-auth-card>
  `,
})
class Host {}

describe('AuthCardComponent', () => {
  const render = async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  it('renders the title and subtitle in a Material card', async () => {
    const host = await render();
    expect(host.querySelector('mat-card mat-card-title')?.textContent?.trim()).toBe('Welcome');
    expect(host.querySelector('mat-card mat-card-subtitle')?.textContent?.trim()).toBe(
      'Create the admin account',
    );
  });

  it('projects the body into the card content and actions into the card actions', async () => {
    const host = await render();
    expect(host.querySelector('mat-card-content [data-testid="body"]')).not.toBeNull();
    expect(host.querySelector('mat-card-actions [data-testid="action"]')).not.toBeNull();
  });

  it('is the page main landmark', async () => {
    const host = await render();
    expect(host.querySelector('main mat-card')).not.toBeNull();
  });
});
