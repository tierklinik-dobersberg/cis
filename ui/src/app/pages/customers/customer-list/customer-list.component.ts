import { ChangeDetectionStrategy, Component, effect, inject, model, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { PartialMessage } from "@bufbuild/protobuf";
import { ConnectError } from "@connectrpc/connect";
import { BrnSeparatorComponent } from "@spartan-ng/ui-separator-brain";
import { BrnTableModule } from "@spartan-ng/ui-table-brain";
import { BrnTooltipModule } from "@spartan-ng/ui-tooltip-brain";
import { HlmBadgeDirective } from "@tierklinik-dobersberg/angular/badge";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { HlmCardModule } from "@tierklinik-dobersberg/angular/card";
import { injectCustomerService } from "@tierklinik-dobersberg/angular/connect";
import { HlmDialogService } from "@tierklinik-dobersberg/angular/dialog";
import { HlmIconModule, provideIcons } from "@tierklinik-dobersberg/angular/icon";
import { HlmInputDirective } from "@tierklinik-dobersberg/angular/input";
import { HlmLabelDirective } from "@tierklinik-dobersberg/angular/label";
import { JoinListPipe } from "@tierklinik-dobersberg/angular/pipes";
import { HlmSeparatorDirective } from "@tierklinik-dobersberg/angular/separator";
import { HlmTableModule } from "@tierklinik-dobersberg/angular/table";
import { HlmTooltipModule } from "@tierklinik-dobersberg/angular/tooltip";
import { CustomerQuery, CustomerResponse, SearchCustomerResponse } from "@tierklinik-dobersberg/apis/customer/v1";
import { toast } from "ngx-sonner";
import { TkdPaginationComponent } from "src/app/components/pagination";
import { CustomerDetailsDialog } from "src/app/dialogs/customer-details-dialog";
import { AsyncPaginationManager } from "src/app/utils/pagination-manager";

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
        HlmInputDirective,
        FormsModule,
        BrnSeparatorComponent,
        JoinListPipe,
        HlmSeparatorDirective,
        HlmTooltipModule,
        BrnTooltipModule
    ],
    providers: [
        ...provideIcons({})
    ]
})
export class CustomerListComponent {
    private readonly customerSerivce = injectCustomerService();
    private readonly dialog = inject(HlmDialogService);

    protected readonly searchByName = model('');
    protected readonly loading = signal(false);
    protected readonly customers = signal<CustomerResponse[]>([]);

    protected readonly paginator = new AsyncPaginationManager(this.customers);

    private _lastCustomerResponse: SearchCustomerResponse | null = null;
    constructor() {
        effect(() => {
            const page = this.paginator.currentPage();
            const pageSize = this.paginator.pageSize();

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
                    pagination: {
                        kind: {
                            case: 'page',
                            value: page,
                        },
                        pageSize: pageSize,
                    }
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
                    this.paginator.setTotalCount(Number(response.totalResults))
                })
        }, { allowSignalWrites: true })
    }

    protected showDetails(customer: CustomerResponse) {
        CustomerDetailsDialog.open(this.dialog, customer);
    }
}