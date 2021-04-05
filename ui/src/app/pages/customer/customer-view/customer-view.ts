import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { BehaviorSubject, combineLatest, forkJoin, of, Subscription } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import { CallLog, CalllogAPI, CallLogModel, Comment, CommentAPI, LocalPatient, PatientAPI, UserService } from 'src/app/api';
import { Customer, CustomerAPI } from 'src/app/api/customer.api';
import { LayoutService } from 'src/app/services';
import { HeaderTitleService } from 'src/app/shared/header-title';
import { extractErrorMessage } from 'src/app/utils';
import { customerTagColor, ExtendedCustomer } from '../utils';

@Component({
  templateUrl: './customer-view.html',
  styleUrls: ['./customer-view.scss']
})
export class CustomerViewComponent implements OnInit, OnDestroy {

  constructor(
    public layout: LayoutService,
    private header: HeaderTitleService,
    private customerapi: CustomerAPI,
    private patientapi: PatientAPI,
    private calllogapi: CalllogAPI,
    private userService: UserService,
    private activatedRoute: ActivatedRoute,
    private commentapi: CommentAPI,
    private nzMessageService: NzMessageService,
    private changeDetector: ChangeDetectorRef
  ) { }

  private subscriptions = Subscription.EMPTY;

  allComments: Comment[] = [];
  totalCallTime = 0;
  callrecords: CallLog[] = [];
  customerComment: Comment | null = null;
  customer: ExtendedCustomer | null = null;
  reload = new BehaviorSubject<void>(undefined);
  showCommentModal = false;
  commentText = '';
  showCommentDrawer = false;
  missingData: string[] = [];
  patients: LocalPatient[] = [];

  heatMapSeries: any[] = [];
  callLogSeries: any[] = [];
  // options
  xAxisLabel = 'Tag';
  yAxisLabel = 'Anrufe';

  colorScheme = {
    domain: ['#5AA454', '#E44D25', '#CFC0BB', '#7aa3e5', '#a8385d', '#aae3f5']
  };

  handleCommentCancel(): void {
    this.showCommentModal = false;
    this.commentText = '';
  }

  handleCommentOk(): void {
    if (this.commentText === '') {
      return;
    }
    this.commentapi.create(`customer:primaryNote:${this.customer.source}:${this.customer.cid}`, this.commentText)
      .subscribe(
        () => {
          this.customerComment = null;
          this.showCommentModal = false;
          this.commentText = '';
          this.reload.next();
        },
        err => {
          this.nzMessageService.error(extractErrorMessage(err, 'Notiz konnte nicht gespeichert werden'));
        }
      );
  }

  editComment(): void {
    this.showCommentModal = true;
    this.commentText = this.customerComment?.message || '';
  }

  toggleComments(): void {
    this.showCommentDrawer = !this.showCommentDrawer;
    this.commentText = '';
  }

  ngOnInit(): void {
    this.subscriptions = new Subscription();

    interface ForkJoinResult {
      customer: Customer;
      calllogs: CallLog[];
      patients: LocalPatient[];
      notes: Comment[];
    }

    const routerSub = combineLatest([
      this.activatedRoute.paramMap,
      this.userService.updated,
      this.reload,
    ])
      .pipe(
        mergeMap(([params]) => {
          const source = params.get('source');
          const id = params.get('cid');
          return forkJoin({
            customer: this.customerapi.byId(source, id),
            calllogs: this.calllogapi.forCustomer(source, id),
            patients: this.patientapi.getPatientsForCustomer(source, id),
            notes: this.commentapi.list(`customer:primaryNote:${source}:${id}`, false, true)
              .pipe(catchError(err => of([])))
          });
        }),
        catchError(err => {
          this.nzMessageService.error(extractErrorMessage(err, 'Kunde konnte nicht geladen werden'));
          return of(null);
        }),
      )
      .subscribe((result: ForkJoinResult | null) => {
        if (!result) {
          this.header.set(`Kunde: N/A`);
          return;
        }

        this.callrecords = result.calllogs;
        this.updateCallLogGraphs();

        this.allComments = [];
        this.customerComment = null;
        if (result.notes?.length > 0) {
          this.allComments = result.notes;
          // always display the very last note created.
          this.customerComment = result.notes[result.notes.length - 1];
        }

        this.customer = {
          ...result.customer,
          tagColor: customerTagColor(result.customer),
        };

        this.patients = result.patients,

          this.findMissingData();

        this.header.set(`Kunde: ${this.customer.name} ${this.customer.firstname}`);
        this.changeDetector.detectChanges();
      }, err => console.error(err));

    this.subscriptions.add(routerSub);
  }

  trackLog(_: number, log: CallLogModel): string | null {
    return log._id || null;
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
      let count = counts.get(record.datestr) || 0;
      count++;
      counts.set(record.datestr, count);

      let sumDuration = sums.get(record.datestr) || 0;
      sumDuration += record.durationSeconds || 0;
      sums.set(record.datestr, sumDuration);

      const d = new Date(record.date);
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
