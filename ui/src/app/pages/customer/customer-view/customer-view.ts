import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { NzMessageService } from "ng-zorro-antd/message";
import { of, Subscription } from "rxjs";
import { catchError, mergeMap } from "rxjs/operators";
import { Customer, CustomerAPI } from "src/app/api/customer.api";
import { extractErrorMessage } from "src/app/utils";

@Component({
    templateUrl: './customer-view.html',
    styleUrls: ['./customer-view.scss']
})
export class CustomerViewComponent implements OnInit, OnDestroy {
    private subscriptions = Subscription.EMPTY;

    customer: Customer | null = null;

    constructor(
        private customerapi: CustomerAPI,
        private activatedRoute: ActivatedRoute,
        private nzMessageService: NzMessageService,
    ) { }

    ngOnInit() {
        this.subscriptions = new Subscription();

        const routerSub = this.activatedRoute.paramMap
            .pipe(
                mergeMap(params => {
                    return this.customerapi.byId(params.get('cid'))
                }),
                catchError(err => {
                    this.nzMessageService.error(extractErrorMessage(err, 'Kunde konnte nicht geladen werden'))
                    return of(null);
                })
            )
            .subscribe(customer => {
                console.log(customer);
                this.customer = customer;
            })
        this.subscriptions.add(routerSub);
    }

    ngOnDestroy() {
        this.subscriptions.unsubscribe();
    }
}