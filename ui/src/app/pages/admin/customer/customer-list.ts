import { Component, OnDestroy, OnInit, TrackByFunction } from "@angular/core";
import { NzMessageService } from "ng-zorro-antd/message";
import { Subscription } from "rxjs";
import { Customer, CustomerAPI } from "src/app/api/customer.api";
import { extractErrorMessage } from "src/app/utils";

@Component({
    templateUrl: './customer-list.html',
    styleUrls: ['./customer-list.scss']
})
export class CustomerListComponent implements OnInit, OnDestroy {
    private subscriptions = Subscription.EMPTY;

    searchText = ''
    customers: Customer[] = [];
    searching = false;

    trackBy: TrackByFunction<Customer> = (_: number, cust: Customer) => cust.cid;

    constructor(
        private customerapi: CustomerAPI,
        private nzMessageService: NzMessageService,
    ) { }

    ngOnInit() {
        this.subscriptions = new Subscription();
    }

    ngOnDestroy() {
        this.subscriptions.unsubscribe();
    }

    search(term: string) {
        this.searching = true;
        this.customerapi.search(term)
            .subscribe(
                result => {
                    console.log(result);
                    this.customers = result;
                },
                err => {
                    const msg = extractErrorMessage(err, "Suche fehlgeschlagen")
                    this.nzMessageService.error(msg);

                    this.customers = [];
                },
                () => {
                    this.searching = false;
                })
    }
}