import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { PartialMessage } from "@bufbuild/protobuf";
import { lucideMapPin } from "@ng-icons/lucide";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { HlmIconModule, provideIcons } from "@tierklinik-dobersberg/angular/icon";
import { HlmTableModule } from "@tierklinik-dobersberg/angular/table";
import { Customer, CustomerResponse } from "@tierklinik-dobersberg/apis/customer/v1";
import { CustomerRoutePipe } from "src/app/pipes/customer-route.pipe";

@Component({
    selector: 'app-customer-details',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        HlmButtonDirective,
        CustomerRoutePipe,
        HlmIconModule,
        HlmTableModule
    ],
    templateUrl: './customer-details-table.html',
    providers: [
        ...provideIcons({lucideMapPin})
    ]
})
export class CustomerDetailsTableComponent {
    public readonly customer = input.required<PartialMessage<CustomerResponse> | PartialMessage<Customer>>();

    protected readonly _customer = computed<PartialMessage<Customer> | null>(() => {
        const customer = this.customer()

        if (!customer) {
            return null;
        }

        if ('customer' in customer) {
            return customer.customer
        }

        return customer as PartialMessage<Customer>;
    })
}