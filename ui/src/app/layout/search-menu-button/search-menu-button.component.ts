import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { lucideCalendarSearch, lucideSearch, lucideUserRoundSearch } from "@ng-icons/lucide";
import { BrnMenuModule } from "@spartan-ng/ui-menu-brain";
import { BrnTooltipModule } from "@spartan-ng/ui-tooltip-brain";
import { HlmBadgeDirective } from "@tierklinik-dobersberg/angular/badge";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { HlmDialogService } from "@tierklinik-dobersberg/angular/dialog";
import { HlmIconModule, provideIcons } from "@tierklinik-dobersberg/angular/icon";
import { HlmMenuModule } from "@tierklinik-dobersberg/angular/menu";
import { HlmTooltipModule } from "@tierklinik-dobersberg/angular/tooltip";
import { AppMenuComponent } from "src/app/components/app-menu";
import { SearchEventsDialogComponent } from "src/app/features/calendar2/search-events-dialog/search-events-dialog.component";
import { CustomerSearchDialogComponent } from "src/app/features/customers/customer-search-dialog";

@Component({
    selector: 'app-search-menu-button',
    standalone: true,
    templateUrl: './search-menu-button.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        HlmMenuModule,
        BrnMenuModule,
        HlmButtonDirective,
        HlmIconModule,
        HlmTooltipModule,
        BrnTooltipModule,
        AppMenuComponent,
        HlmBadgeDirective
    ],
    providers: [
        ...provideIcons({
            lucideSearch,
            lucideCalendarSearch,
            lucideUserRoundSearch
        })
    ]
})
export class AppSearchMenuButtonComponent {
    private dialog = inject(HlmDialogService)

    protected searchEvents() {
        SearchEventsDialogComponent.open(this.dialog)
    }

    protected searchCustomers() {
        CustomerSearchDialogComponent.open(this.dialog)
    }
}