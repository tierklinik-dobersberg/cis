import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { injectCurrentProfile } from '@tierklinik-dobersberg/angular/behaviors';
import { injectCurrentConfig } from 'src/app/api';
import { EmergencyTargetService } from 'src/app/layout/redirect-emergency-button/emergency-target.service';

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

  protected readonly currentUser = injectCurrentProfile();
  protected readonly config = injectCurrentConfig();

  protected isComputerAccount = computed(() => {
    const profile = this.currentUser();
    const config = this.config();

    return profile.roles.some(r => r.id === config.UI.ComputerAccountRole)
  })

  protected createOverwrite() {
    this.emergencyService.createRedirect();
  }
}
