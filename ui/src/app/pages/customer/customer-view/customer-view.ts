import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { sum } from "ng-zorro-antd/core/util";
import { NzMessageService } from "ng-zorro-antd/message";
import { combineLatest, forkJoin, of, Subscription } from "rxjs";
import { catchError, mergeMap, tap } from "rxjs/operators";
import { CallLogModel, CalllogAPI, CallLog, UserService } from "src/app/api";
import { CustomerAPI } from "src/app/api/customer.api";
import { HeaderTitleService } from "src/app/shared/header-title";
import { extractErrorMessage } from "src/app/utils";
import { customerTagColor, ExtendedCustomer } from "../utils";

@Component({
  templateUrl: './customer-view.html',
  styleUrls: ['./customer-view.scss']
})
export class CustomerViewComponent implements OnInit, OnDestroy {
  private subscriptions = Subscription.EMPTY;

  totalCallTime: number = 0;
  callrecords: CallLog[] = [];
  customer: ExtendedCustomer | null = null;

  constructor(
    private header: HeaderTitleService,
    private customerapi: CustomerAPI,
    private calllogapi: CalllogAPI,
    private userService: UserService,
    private activatedRoute: ActivatedRoute,
    private nzMessageService: NzMessageService,
  ) { }

  ngOnInit() {
    this.subscriptions = new Subscription();

    const routerSub = combineLatest([
      this.activatedRoute.paramMap,
      this.userService.updated,
    ])
      .pipe(
        mergeMap(([params]) => {
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
        }),
      )
      .subscribe(result => {
        if (!result) {
          this.header.set(`Kunde: N/A`);
          return;
        }
        this.callrecords = result.calllogs;

        let counts = new Map<string, number>()
        let sums = new Map<string, number>();
        let heatMapBuckets = new Map<number, Map<number, number>>();

        this.callrecords.forEach(record => {
          let count = counts.get(record.datestr) || 0;
          count++;
          counts.set(record.datestr, count);

          let sum = sums.get(record.datestr) || 0;
          sum += record.durationSeconds || 0;
          sums.set(record.datestr, sum);

          let d = new Date(record.date);
          let hourBucket = heatMapBuckets.get(d.getDay()) || new Map<number, number>();
          heatMapBuckets.set(d.getDay(), hourBucket);

          const hourIdx = Math.floor(d.getHours() / 2);
          let hourCount = hourBucket.get(hourIdx) || 0;
          hourCount++;
          hourBucket.set(hourIdx, hourCount)
        })

        this.callLogSeries = [
          {
            name: "Anrufe",
            series: Array.from(counts.entries()).map(([name, value]) => ({ name, value }))
          },
          {
            name: "Anrufdauer",
            series: Array.from(sums.entries()).map(([name, value]) => ({ name: name, value: value / 60 }))
          },
        ]

        const weekDays = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
        const hours = [4, 5, 6, 7, 8];
        console.log(heatMapBuckets);

        this.heatMapSeries = weekDays.map((day, index) => {
          const values = heatMapBuckets.get(index) || new Map<number, number>();
          return {
            name: day,
            series: hours.map(hourIdx => {
              return {
                name: `${hourIdx * 2}:00-${hourIdx * 2 + 2}:00`,
                value: values.get(hourIdx) || 0,
              }
            })
          }
        })
        console.log(this.heatMapSeries);

        this.customer = {
          ...result.customer,
          tagColor: customerTagColor(result.customer),
        };
        this.header.set(`Kunde: ${this.customer.name} ${this.customer.firstname}`);
      }, err => console.error(err))

    this.subscriptions.add(routerSub);
  }

  trackLog(_: number, log: CallLogModel) {
    return log._id;
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  heatMapSeries: any[] = [];
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
