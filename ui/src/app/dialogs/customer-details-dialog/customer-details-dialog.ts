import { JsonPipe } from "@angular/common";
import { Component, inject } from "@angular/core";
import { BrnDialogRef, injectBrnDialogContext } from "@spartan-ng/ui-dialog-brain";
import { BrnTabsModule } from "@spartan-ng/ui-tabs-brain";
import { BrnTooltipModule } from "@spartan-ng/ui-tooltip-brain";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { HlmDialogModule, HlmDialogService } from "@tierklinik-dobersberg/angular/dialog";
import { HlmTabsModule } from "@tierklinik-dobersberg/angular/tabs";
import { HlmTooltipModule } from "@tierklinik-dobersberg/angular/tooltip";
import { CustomerResponse } from "@tierklinik-dobersberg/apis/customer/v1";
import { CustomerDetailsTableComponent } from "src/app/components/customer-details-table";

const contentClass =
      'w-screen overflow-hidden max-w-[unset] sm:w-[750px] md:w-[750px] h-[100dvh] sm:h-[unset] max-h-screen !max-h-[100dvh]';

export interface CustomerDetailsDialogContext {
    customer: CustomerResponse,

    close: () => void;
}

@Component({
    standalone: true,
    templateUrl: './customer-details-dialog.html',
    imports: [
        HlmDialogModule,
        HlmTooltipModule,
        BrnTooltipModule,
        HlmButtonDirective,
        HlmTabsModule,
        BrnTabsModule,
        CustomerDetailsTableComponent,
        JsonPipe
    ],
    styles: [
        `
        :host {
            display: flex;
            flex-direction: column;
            overflow: hidden;
            max-height: 100%;
        }
        `
    ]
})
export class CustomerDetailsDialog {
    static open(service: HlmDialogService, customer: CustomerResponse): BrnDialogRef<unknown> {
        console.log("opeing customer details", customer)
        return service.open(CustomerDetailsDialog, {
            contentClass: contentClass,
            context: {
                customer: customer,
            }
        })
    }

    protected readonly dialogRef = inject(BrnDialogRef)
    protected readonly context = injectBrnDialogContext<CustomerDetailsDialogContext>();
    protected readonly customer = this.context.customer.customer;
    protected readonly states = this.context.customer.states;
}