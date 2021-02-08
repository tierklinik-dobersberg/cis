import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { sum } from "ng-zorro-antd/core/util";
import { NzMessageService } from "ng-zorro-antd/message";
import { forkJoin, of, Subscription } from "rxjs";
import { catchError, mergeMap } from "rxjs/operators";
import { CallLog, CalllogAPI } from "src/app/api";
import { CustomerAPI } from "src/app/api/customer.api";
import { HeaderTitleService } from "src/app/shared/header-title";
import { extractErrorMessage } from "src/app/utils";
import { customerTagColor, ExtendedCustomer } from "../utils";

interface LocalCallLog extends CallLog {
  localDate: string;
}
@Component({
  templateUrl: './customer-view.html',
  styleUrls: ['./customer-view.scss']
})
export class CustomerViewComponent implements OnInit, OnDestroy {
  private subscriptions = Subscription.EMPTY;

  totalCallTime: number = 0;
  callrecords: LocalCallLog[] = [];
  customer: ExtendedCustomer | null = null;

  constructor(
    private header: HeaderTitleService,
    private customerapi: CustomerAPI,
    private calllogapi: CalllogAPI,
    private activatedRoute: ActivatedRoute,
    private nzMessageService: NzMessageService,
  ) { }

  ngOnInit() {
    this.subscriptions = new Subscription();

    const routerSub = this.activatedRoute.paramMap
      .pipe(
        mergeMap(params => {
          const source = params.get("source");
          const id = params.get("cid")
          return forkJoin({
            customer: this.customerapi.byId(source, id),
            calllogs: this.calllogapi.forCustomer(source, id),
          })
        }),
        catchError(err => {
          this.nzMessageService.error(extractErrorMessage(err, 'Kunde konnte nicht geladen werden'))
          return of(null);
        })
      )
      .subscribe(result => {
        if (!result) {
          this.header.set(`Kunde: N/A`);
          return;
        }
        this.callrecords = result.calllogs.map(l => ({
          ...l,
          localDate: new Date(l.date).toLocaleDateString(),
        }));

        this.totalCallTime = sum(this.callrecords.map(l => l.durationSeconds));

        let counts = new Map<string, number>()
        let sums = new Map<string, number>();
        this.callrecords.forEach(record => {
          let count = counts.get(record.datestr) || 0;
          let sum = sums.get(record.datestr) || 0;
          count++;
          sum += record.durationSeconds || 0;
          counts.set(record.datestr, count);
          sums.set(record.datestr, sum);
        })

        this.callLogSeries = [
          {
            name: "Anrufe",
            series: Array.from(counts.entries()).map(([name, value]) => ({ name, value }))
          },
          {
            name: "Anrufdauer",
            series: Array.from(sums.entries()).map(([name, value]) => ({ name, value }))
          },
        ]

        this.customer = {
          ...result.customer,
          tagColor: customerTagColor(result.customer),
        };
        this.header.set(`Kunde: ${this.customer.name} ${this.customer.firstname}`);
      })
    this.subscriptions.add(routerSub);
  }

  trackLog(_: number, log: CallLog) {
    return log._id;
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }


  callLogSeries: any[] = [];
  // options
  xAxisLabel: string = 'Tag';
  yAxisLabel: string = 'Anrufe';

  colorScheme = {
    domain: ['#5AA454', '#E44D25', '#CFC0BB', '#7aa3e5', '#a8385d', '#aae3f5']
  };

  onSelect(data): void {
    console.log('Item clicked', JSON.parse(JSON.stringify(data)));
  }

  onActivate(data): void {
    console.log('Activate', JSON.parse(JSON.stringify(data)));
  }

  onDeactivate(data): void {
    console.log('Deactivate', JSON.parse(JSON.stringify(data)));
  }
}
