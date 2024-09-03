import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { PartialMessage } from "@bufbuild/protobuf";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { HlmTableModule } from "@tierklinik-dobersberg/angular/table";
import { Customer, CustomerResponse } from "@tierklinik-dobersberg/apis/customer/v1";

@Component({
    selector: 'app-customer-details',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        HlmButtonDirective,
        HlmTableModule
    ],
    templateUrl: './customer-details-table.html'
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