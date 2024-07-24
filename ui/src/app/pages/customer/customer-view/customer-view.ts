import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ConnectError } from '@connectrpc/connect';
import { ScaleType } from '@swimlane/ngx-charts';
import { Color } from '@swimlane/ngx-charts/lib/utils/color-sets';
import { CallEntry, GetLogsForCustomerResponse } from '@tierklinik-dobersberg/apis/gen/es/tkd/pbx3cx/v1/calllog_pb';
import { NzMessageService } from 'ng-zorro-antd/message';
import { BehaviorSubject, combineLatest, forkJoin, of, Subscription } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import { LocalPatient, PatientAPI } from 'src/app/api';
import { CALL_SERVICE } from 'src/app/api/connect_clients';
import { Customer, CustomerAPI } from 'src/app/api/customer.api';
import { HeaderTitleService } from 'src/app/layout/header-title';
import { LayoutService } from 'src/app/services';
import { extractErrorMessage, toDateString } from 'src/app/utils';
import { customerTagColor, ExtendedCustomer, getMapsRouteUrl } from '../utils';

@Component({
  templateUrl: './customer-view.html',
  styleUrls: ['./customer-view.scss']
})
export class CustomerViewComponent implements OnInit, OnDestroy {
  @ViewChild('customerSelectPhone', {static: true, read: TemplateRef})
  customerSelectPhone: TemplateRef<any> | null = null;

  private callService = inject(CALL_SERVICE)

  public readonly layout = inject(LayoutService).withAutoUpdate()

  constructor(
    private header: HeaderTitleService,
    private customerapi: CustomerAPI,
    private patientapi: PatientAPI,
    private activatedRoute: ActivatedRoute,
    private nzMessageService: NzMessageService,
    private changeDetector: ChangeDetectorRef,
    //private bottomSheet: MatBottomSheet,
  ) { }

  private subscriptions = Subscription.EMPTY;

//  bottomSheetRef: MatBottomSheetRef | null = null;

  callrecords: CallEntry[] = [];
  customer: ExtendedCustomer | null = null;
  reload = new BehaviorSubject<void>(undefined);
  commentText = '';
  missingData: string[] = [];
  patients: LocalPatient[] = [];

  heatMapSeries: any[] = [];
  callLogSeries: any[] = [];
  // options
  xAxisLabel = 'Tag';
  yAxisLabel = 'Anrufe';

  lineScheme: Color = {
    name: 'group',
    group: ScaleType.Linear,
    selectable: false,
    domain: ['#5AA454', '#E44D25', '#CFC0BB', '#7aa3e5', '#a8385d', '#aae3f5']
  };

  areaScheme: Color = {
    name: 'group',
    group: ScaleType.Linear,
    selectable: false,
    domain: ['#5AA45410', '#A10A2850']
  }

  ngOnInit(): void {
    this.subscriptions = new Subscription();

    interface ForkJoinResult {
      customer: Customer;
      calllogs: GetLogsForCustomerResponse | ConnectError;
      patients: LocalPatient[] | HttpErrorResponse;
    }

    const routerSub = combineLatest([
      this.activatedRoute.paramMap,
      this.activatedRoute.queryParamMap,
      this.reload,
    ])
      .pipe(
        mergeMap(([params]) => {
          const source = params.get('source');
          const id = params.get('cid');
          return forkJoin({
            customer: this.customerapi.byId(source, id),
            calllogs: this.callService.getLogsForCustomer({
              id: id,
              source: source,
            }).catch(err => ConnectError.from(err)),
            patients: this.patientapi.getPatientsForCustomer(source, id)
              .pipe(catchError(err => of(err))),
          });
        }),
        catchError(err => {
          // this can only happen if we fail to load the customer at all
          this.nzMessageService.error(extractErrorMessage(err, 'Kunde konnte nicht geladen werden'));
          return of(null);
        }),
      )
      .subscribe((result: ForkJoinResult | null) => {
        if (!result) {
          this.header.set(`Kunde: N/A`);
          return;
        }

        this.callrecords = [];
        if (result.calllogs instanceof GetLogsForCustomerResponse) {
          this.callrecords = result.calllogs.results;

          this.updateCallLogGraphs();
        } else {
          this.nzMessageService.error(
            extractErrorMessage(result.calllogs, 'Anruf Journal konnte nicht geladen werden')
          );
        }

        this.customer = {
          ...result.customer,
          tagColor: customerTagColor(result.customer),
          mapsUrl: getMapsRouteUrl(result.customer),
        };

        this.patients = [];
        if (Array.isArray(result.patients)) {
          this.patients = result.patients;
        } else {
          this.nzMessageService.error(
            extractErrorMessage(result.patients, 'Patienten konnten nicht geladen werden')
          );
        }

        this.findMissingData();

        this.header.set(`Kunde: ${this.customer.name} ${this.customer.firstname}`);
        this.changeDetector.detectChanges();
      }, err => console.error(err));

    this.subscriptions.add(routerSub);
  }

  callCustomer(cus: ExtendedCustomer) {
    if (cus.distinctPhoneNumbers.length === 1) {
      window.open(`tel:` + cus.distinctPhoneNumbers[0])
    }

    /** FIXME
    this.bottomSheetRef = this.bottomSheet.open(this.customerSelectPhone!, {
      data: cus,
    })
    this.bottomSheetRef.afterDismissed()
      .subscribe(() => this.bottomSheetRef = null);
    */
  }


  trackLog(_: number, log: CallEntry): string | null {
    return log.id || null;
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private findMissingData(): void {
    const checks: { name: string; key: keyof ExtendedCustomer }[] = [
      { name: 'Postleitzahl', key: 'cityCode' },
      { name: 'Stadt', key: 'city' },
      { name: 'Nachname', key: 'name' },
      { name: 'Vorname', key: 'firstname' },
      { name: 'E-Mail Adresse', key: 'mailAddresses' },
      { name: 'Telefonnummer', key: 'phoneNumbers' },
      { name: 'Straße', key: 'street' },
    ];

    this.missingData = checks
      .filter(check => {
        const value = this.customer[check.key];
        if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
          return true;
        }
        return false;
      })
      .map(check => check.name);
  }

  private updateCallLogGraphs(): void {
    const counts = new Map<string, number>();
    const sums = new Map<string, number>();
    const heatMapBuckets = new Map<number, Map<number, number>>();

    this.callrecords.forEach(record => {
      const dateStr = toDateString(record.receivedAt.toDate())

      let count = counts.get(dateStr) || 0;
      count++;
      counts.set(dateStr, count);

      let sumDuration = sums.get(dateStr) || 0;
      sumDuration += Number(record.duration.seconds)
      sums.set(dateStr, sumDuration);

      const d = record.receivedAt.toDate()
      const hourBucket = heatMapBuckets.get(d.getDay()) || new Map<number, number>();
      heatMapBuckets.set(d.getDay(), hourBucket);

      const hourIdx = Math.floor(d.getHours() / 2);
      let hourCount = hourBucket.get(hourIdx) || 0;
      hourCount++;
      hourBucket.set(hourIdx, hourCount);
    });

    this.callLogSeries = [
      {
        name: 'Anrufe',
        series: Array.from(counts.entries()).map(([name, value]) => ({ name, value }))
      },
      {
        name: 'Anrufdauer',
        series: Array.from(sums.entries()).map(([name, value]) => ({ name, value: value / 60 }))
      },
    ];

    const weekDays = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    const hours = [4, 5, 6, 7, 8];

    this.heatMapSeries = weekDays.map((day, index) => {
      const values = heatMapBuckets.get(index) || new Map<number, number>();
      return {
        name: day,
        series: hours.map(hourIdx => {
          return {
            name: `${hourIdx * 2}:00-${hourIdx * 2 + 2}:00`,
            value: values.get(hourIdx) || 0,
          };
        })
      };
    });
  }
}
