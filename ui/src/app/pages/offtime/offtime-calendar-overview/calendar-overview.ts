import { ChangeDetectionStrategy, Component, Input, EventEmitter, Output, inject, ViewChild, TemplateRef, ChangeDetectorRef, OnInit, OnChanges, SimpleChanges } from "@angular/core";
import { Timestamp } from "@bufbuild/protobuf";
import { OFFTIME_SERVICE } from "@tierklinik-dobersberg/angular/connect";
import { FindOffTimeRequestsResponse, OffTimeEntry, Profile } from "@tierklinik-dobersberg/apis";
import { CandyDate } from "ng-zorro-antd/core/time";
import { LayoutService } from "src/app/services";


@Component({
  selector: 'app-offtime-calendar-overview',
  templateUrl: './calendar-overview.html',
  exportAs: 'calendarView',
  styles: [
    `
    ::ng-deep #custom-calendar .ant-picker-cell-selected .ant-picker-cell-inner {
      background-color: white !important;
      border-color: white !important;
    }

    #calendar ::ng-deep .ant-picker-cell-selected .ant-picker-cell-inner {
      @apply bg-white;
    }

    #calendar ::ng-deep .ant-picker-cell-inner {
      @apply border-0;
    }

    #calendar ::ng-deep .ant-picker-cell-inner:hover {
      @apply bg-white;
    }

    #calendar ::ng-deep .ant-picker-cell-selected .ant-picker-cell-inner .date-header {
      @apply text-primary;
    }

    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OffTimeCalendarOverviewComponent implements OnInit, OnChanges {
  readonly layout = inject(LayoutService).withAutoUpdate();
  readonly offTimeService = inject(OFFTIME_SERVICE);
  readonly cdr = inject(ChangeDetectorRef)

  @ViewChild('dateCell', {read: TemplateRef, static: true})
  dateCellRender: TemplateRef<Date>;

  @Input() profiles: Profile[] = [];
  @Input() hoverValue: [CandyDate, CandyDate] | null = null;

  @Input()
  calendarDate: CandyDate = new CandyDate();

  @Output()
  calendarDateChange = new EventEmitter<CandyDate>();

  @Input()
  mode: 'list' | 'calendar' = 'list';

  hoveredEntryId: string | null = null;

  existing: OffTimeEntry[] = [];

  loading = false;

  ngOnInit(): void {
    this.load(this.calendarDate);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('calendarDate' in changes && !changes['calendarDate'].isFirstChange()) {
      this.load(this.calendarDate);
    }
  }

  load(date: CandyDate | Date) {
    this.loading = true;
    this.cdr.detectChanges();

    if (date instanceof Date) {
      date = new CandyDate(date)
    }

    this.calendarDate = date;

    const from = new Date(date.nativeDate.getFullYear(), date.getMonth(), 1)
    const to = new Date(date.nativeDate.getFullYear(), date.getMonth() + 1, 0);

    this.calendarDateChange.next(date);

    try {
      this.offTimeService
        .findOffTimeRequests({
          from: Timestamp.fromDate(from),
          to: Timestamp.fromDate(to),
        })
        .catch(err => {
          return new FindOffTimeRequestsResponse()
        })
        .then(response => {
          this.existing = response.results || [];
          this.loading = false;

          this.cdr.markForCheck();
        })
    } catch(err) {
    }
  }}
