import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmergencyTargetService } from 'src/app/layout/redirect-emergency-button/emergency-target.service';
import { injectStoredConfig, injectStoredProfile } from 'src/app/utils/inject-helpers';

@Component({
  selector: 'app-mobile-welcome-card',
  templateUrl: './mobile-welcome-card.html',
  styleUrls: ['./mobile-welcome-card.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    RouterLink
  ]
})
export class MobileWelcomeCardComponent {
  private readonly emergencyService = inject(EmergencyTargetService)

  protected readonly currentUser = injectStoredProfile();
  protected readonly config = injectStoredConfig();

  protected isComputerAccount = computed(() => {
    const profile = this.currentUser();
    const config = this.config();

    return profile.roles.some(r => r.id === config.UI.ComputerAccountRole)
  })

  protected createOverwrite() {
    this.emergencyService.createRedirect();
  }
}
