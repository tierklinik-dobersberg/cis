import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { BrnTooltipModule } from '@spartan-ng/ui-tooltip-brain';
import { injectUserProfiles } from "@tierklinik-dobersberg/angular/behaviors";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { DisplayNamePipe, ToUserPipe } from "@tierklinik-dobersberg/angular/pipes";
import { HlmTooltipModule } from '@tierklinik-dobersberg/angular/tooltip';
import { EmergencyTargetService } from '../emergency-target.service';

@Component({
    selector: 'app-redirect-emergency-button',
    standalone: true,
    templateUrl: './redirect-emergency-button.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        HlmButtonDirective,
        BrnTooltipModule,
        HlmTooltipModule,
        ToUserPipe,
        DisplayNamePipe
    ]
})
export class AppRedirectEmergencyButtonComponent { 
  protected readonly emergencyService = inject(EmergencyTargetService);
  protected readonly profiles = injectUserProfiles(); 
  protected readonly overwrite = computed(() => this.emergencyService.target())

  /** Returns the button variant for the "overwrite" button */
  protected readonly _computedOverwriteButtonVariant = computed(() => {
    const overwrite = this.overwrite();

    if (!overwrite) {
      return 'outline'
    }

    return 'destructive';
  })
}