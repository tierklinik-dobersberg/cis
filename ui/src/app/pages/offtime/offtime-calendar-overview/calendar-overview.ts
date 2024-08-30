import { CdkTableModule } from "@angular/cdk/table";
import { DatePipe, NgClass } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, signal, TemplateRef, TrackByFunction, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { Timestamp } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { lucideArrowLeft, lucideArrowRight } from "@ng-icons/lucide";
import { BrnTableModule } from '@spartan-ng/ui-table-brain';
import { BrnTooltipModule } from "@spartan-ng/ui-tooltip-brain";
import { injectUserProfiles } from "@tierklinik-dobersberg/angular/behaviors";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { OFFTIME_SERVICE } from "@tierklinik-dobersberg/angular/connect";
import { TkdEmptyTableComponent } from '@tierklinik-dobersberg/angular/empty-table';
import { HlmIconModule, provideIcons } from "@tierklinik-dobersberg/angular/icon";
import { HlmInputDirective } from "@tierklinik-dobersberg/angular/input";
import { LayoutService } from "@tierklinik-dobersberg/angular/layout";
import { DisplayNamePipe, InListPipe, ToDatePipe, ToUserPipe, UserColorPipe, UserContrastColorPipe } from "@tierklinik-dobersberg/angular/pipes";
import { HlmTableModule } from '@tierklinik-dobersberg/angular/table';
import { HlmTooltipModule } from "@tierklinik-dobersberg/angular/tooltip";
import { FindOffTimeRequestsResponse, OffTimeEntry } from "@tierklinik-dobersberg/apis/roster/v1";
import { NzCalendarModule } from "ng-zorro-antd/calendar";
import { CandyDate } from "ng-zorro-antd/core/time";
import { LibPackerModule } from "ng-zorro-antd/date-picker";
import { toast } from 'ngx-sonner';
import { AppDateTableModule, CalendarRange } from "src/app/components/date-table";
import { UserColorVarsDirective } from "src/app/components/user-color-vars";
import { toDateString } from "src/app/utils";
import { AppAvatarComponent } from "../../../components/avatar/avatar.component";
import { MatchingOfftimeTooltipPipe } from "../pipes/matching-offtime-tooltip.pipe";
import { MatchingOfftimePipe } from "../pipes/matching-offtime.pipe";

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
          @apply border-0 !font-normal;
        }

        #calendar ::ng-deep .ant-picker-cell-inner:hover {
          @apply bg-white;
        }

        #calendar ::ng-deep .ant-picker-cell-selected .ant-picker-cell-inner .date-header {
          @apply !text-gray-800;
        }
        #calendar ::ng-deep .ant-picker-cell-selected .ant-picker-cell-inner {
          @apply !text-gray-800;
        }

        `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    LibPackerModule,
    NzCalendarModule,
    DatePipe,
    ToDatePipe,
    DisplayNamePipe,
    NgClass,
    FormsModule,
    MatchingOfftimePipe,
    MatchingOfftimeTooltipPipe,
    UserColorPipe,
    UserContrastColorPipe,
    InListPipe,
    ToUserPipe,
    HlmButtonDirective,
    HlmIconModule,
    HlmTableModule,
    BrnTableModule,
    TkdEmptyTableComponent,
    AppAvatarComponent,
    BrnTooltipModule,
    HlmTooltipModule,
    UserColorVarsDirective,
    CdkTableModule,
    HlmInputDirective,
    AppDateTableModule
],
  providers: [
    ...provideIcons({
      lucideArrowLeft,
      lucideArrowRight,
    })
  ]
})
export class OffTimeCalendarOverviewComponent {
  protected readonly profiles = injectUserProfiles();
  protected readonly layout = inject(LayoutService);

  private readonly offTimeService = inject(OFFTIME_SERVICE);
  private readonly router = inject(Router)

  // Inputs & Outputs
  public readonly calendarRanges = input<CalendarRange[]>([]);
  public readonly calendarDate = model<CandyDate>(new CandyDate());
  public readonly mode = input<'list' | 'calendar'>('list')

  @ViewChild('dateCell', {read: TemplateRef, static: true})
  public readonly dateCellRender: TemplateRef<Date>;
  
  // Template Signals and Variables
  protected readonly entries = signal<OffTimeEntry[]>([]);
  protected readonly hoveredEntryId = signal<string | null>(null);
  protected readonly _computedNativeDate = computed(() => {
    return this.calendarDate().nativeDate;
  })
  protected readonly _computedDisplayedColumns = computed(() => {
    const isMd = this.layout.md();
    
    if (isMd) {
      return [
        'from', 'to', 'user', 'description'
      ];
    }
      return [
        'from', 'to', 'user'
      ];
  })
  protected readonly trackEntry: TrackByFunction<OffTimeEntry> = (_, e) => e.id;
  
  constructor() {
    let lastAbrtCtrl: AbortController | null = null;

    effect(() => {
      const date = this.calendarDate();
      const from = new Date(date.nativeDate.getFullYear(), date.getMonth(), 1)
      const to = new Date(date.nativeDate.getFullYear(), date.getMonth() + 1, 0);
      
      if (lastAbrtCtrl !== null) {
        lastAbrtCtrl.abort();
      }
      
      const abrt = new AbortController();
      lastAbrtCtrl = abrt;

      this.offTimeService
        .findOffTimeRequests({
          from: Timestamp.fromDate(from),
          to: Timestamp.fromDate(to),
        }, {signal: abrt.signal})
        .catch(err => {
          const cErr = ConnectError.from(err);
          if (cErr.code !== Code.NotFound) {
            toast.error('Anträge konnten nicht geladen werden', {description: cErr.message})
          }
          
          return new FindOffTimeRequestsResponse();
        })
        .then(response => {
          if (abrt === lastAbrtCtrl) {
            lastAbrtCtrl = null;
          }

          // drop the response if the user already changed again.
          if (date === this.calendarDate()) {
            this.entries.set(response.results || []);
          }
        })
    }, { allowSignalWrites: true });
  }

  protected createEntry(date: Date) {
    this.router.navigate(['/offtime/create'], {
        queryParams: {
          d: toDateString(date),
        },
        queryParamsHandling: 'merge'
    })
  }

  protected switchDate(date: CandyDate | Date | null, offSetInMonths?: number) {
    if (date === null) {
      date = this.calendarDate();
    }

    if (date instanceof Date) {
      date = new CandyDate(date)
    }
    
    if (offSetInMonths !== undefined) {
      date = date.addMonths(offSetInMonths)
    }
    
    // avoid reloading if nothing changed.
    if (date.getTime() === this.calendarDate().getTime()) {
      return
    }
    
    this.calendarDate.set(date);
  }
}
