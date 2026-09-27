import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SettingsSectionComponent } from './settings-section.component';

@Component({
  imports: [SettingsSectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nala-settings-section title="Account">
      <p data-testid="body">Fields</p>
    </nala-settings-section>
  `,
})
class Host {}

describe('SettingsSectionComponent', () => {
  const render = async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  it('renders the title as a heading of a Material card', async () => {
    const host = await render();
    const title = host.querySelector('section mat-card mat-card-title');
    expect(title?.textContent?.trim()).toBe('Account');
    expect(title?.getAttribute('role')).toBe('heading');
  });

  it('projects the body into the card content', async () => {
    const host = await render();
    expect(host.querySelector('mat-card-content [data-testid="body"]')).not.toBeNull();
  });
});
