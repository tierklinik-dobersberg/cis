import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { BrnTooltipModule } from '@spartan-ng/ui-tooltip-brain';
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { HlmTooltipModule } from '@tierklinik-dobersberg/angular/tooltip';
import { EmergencyTargetService } from "./emergency-target.service";

@Component({
    selector: 'app-redirect-emergency-button',
    standalone: true,
    templateUrl: './redirect-emergency-button.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        HlmButtonDirective,
        BrnTooltipModule,
        HlmTooltipModule,
        RouterLink
    ]
})
export class AppRedirectEmergencyButtonComponent { 
    protected readonly emergencyService = inject(EmergencyTargetService);
    
protected readonly overwriteTarget = computed(() => this.emergencyService.overwriteTarget())

  /** Returns the button variant for the "overwrite" button */
  protected readonly _computedOverwriteButtonVariant = computed(() => {
    const overwrite = this.overwriteTarget();
    console.log("overwrtie", overwrite)

    if (!overwrite) {
      return 'outline'
    }

    return 'destructive';
  })
}