import { ChangeDetectionStrategy, Component, effect, model, signal } from "@angular/core";
import { PartialMessage } from "@bufbuild/protobuf";
import { ConnectError } from "@connectrpc/connect";
import { BrnTableModule } from "@spartan-ng/ui-table-brain";
import { HlmBadgeDirective } from "@tierklinik-dobersberg/angular/badge";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { HlmCardModule } from "@tierklinik-dobersberg/angular/card";
import { injectCustomerService } from "@tierklinik-dobersberg/angular/connect";
import { HlmIconModule, provideIcons } from "@tierklinik-dobersberg/angular/icon";
import { HlmLabelDirective } from "@tierklinik-dobersberg/angular/label";
import { HlmTableModule } from "@tierklinik-dobersberg/angular/table";
import { CustomerQuery, CustomerResponse, SearchCustomerResponse } from "@tierklinik-dobersberg/apis/customer/v1";
import { toast } from "ngx-sonner";
import { TkdPaginationComponent } from "src/app/components/pagination";

@Component({
    standalone: true,
    templateUrl: './customer-list.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        HlmIconModule,
        HlmButtonDirective,
        HlmLabelDirective,
        HlmBadgeDirective,
        HlmTableModule,
        BrnTableModule,
        TkdPaginationComponent,
        HlmCardModule,
    ],
    providers: [
        ...provideIcons({})
    ]
})
export class CustomerListComponent {
    private readonly customerSerivce = injectCustomerService();

    protected readonly searchByName = model('');
    protected readonly loading = signal(false);
    protected readonly customers = signal<CustomerResponse[]>([]);

    private _lastCustomerResponse: SearchCustomerResponse | null = null;
    constructor() {
        effect(() => {
            const search = this.searchByName();

            this.loading.set(true);

            let queries: PartialMessage<CustomerQuery>[] | null = null;

            if (search != "" ) {
                queries = [
                    {
                        query: {
                            case: 'name',
                            value: {
                                lastName: search,
                            }
                        }
                    }
                ]
            }

            this.customerSerivce
                .searchCustomer({
                    queries,
                })
                .catch( err => {
                    toast.error('Kunden konnten nicht geladen werden', {
                        description: ConnectError.from(err).message
                    })

                    return new SearchCustomerResponse()
                })
                .then(response => {
                    if (response.equals(this._lastCustomerResponse)) {
                        return
                    }

                    this._lastCustomerResponse = response;
                    this.customers.set(response.results)
                })
        }, { allowSignalWrites: true })
    }
}