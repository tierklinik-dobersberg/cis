import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from "@angular/core";
import { interval, Subject } from "rxjs";
import { CustomerAPI } from "src/app/api/customer.api";
import { HeaderTitleService } from "src/app/shared/header-title";

@Component({
    templateUrl: './stats.component.html',
    styleUrls: ['./stats.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsPageComponent implements OnInit, OnDestroy {
    private destroy$ = new Subject();

    newCustomerData: any[] = [];

    constructor(
        private headerService: HeaderTitleService,
        private customerapi: CustomerAPI,
        private cdr: ChangeDetectorRef
    ) {

    }

    ngOnInit() {
        this.headerService.set('Statistiken');

        this.customerapi.newCustomerStats(new Date(0, 0, 0), new Date(2100, 1, 1))
            .subscribe(data => {
                console.log(data);
                this.newCustomerData = data;
                this.cdr.markForCheck();
            })
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }
}
