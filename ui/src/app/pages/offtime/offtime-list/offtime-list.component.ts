import { CdkTableModule } from "@angular/cdk/table";
import { DatePipe, KeyValuePipe, NgClass } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, effect, inject, model, OnInit, signal, TrackByFunction, untracked } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { PartialMessage, Timestamp } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { lucideArrowLeft, lucideArrowRight, lucideCalendar, lucideCheckCircle, lucideMessageCircle, lucideXCircle } from "@ng-icons/lucide";
import { BrnAlertDialogModule } from "@spartan-ng/ui-alertdialog-brain";
import { BrnHoverCardContentService, BrnHoverCardModule } from '@spartan-ng/ui-hovercard-brain';
import { BrnSelectModule } from "@spartan-ng/ui-select-brain";
import { BrnSeparatorModule } from "@spartan-ng/ui-separator-brain";
import { BrnSheetModule } from "@spartan-ng/ui-sheet-brain";
import { BrnTableModule } from "@spartan-ng/ui-table-brain";
import { BrnTabsModule } from '@spartan-ng/ui-tabs-brain';
import { BrnTooltipModule } from "@spartan-ng/ui-tooltip-brain";
import { HlmAlertDialogModule } from "@tierklinik-dobersberg/angular/alertdialog";
import { HlmBadgeModule } from "@tierklinik-dobersberg/angular/badge";
import { injectCurrentProfile, injectUserProfiles } from "@tierklinik-dobersberg/angular/behaviors";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { HlmCardModule } from "@tierklinik-dobersberg/angular/card";
import { injectCommentService, injectOfftimeService, injectWorktimeSerivce } from "@tierklinik-dobersberg/angular/connect";
import { TkdEmptyTableComponent } from "@tierklinik-dobersberg/angular/empty-table";
import { HlmHoverCardModule } from '@tierklinik-dobersberg/angular/hovercard';
import { HlmIconModule, provideIcons } from "@tierklinik-dobersberg/angular/icon";
import { HlmLabelDirective } from "@tierklinik-dobersberg/angular/label";
import { LayoutService } from "@tierklinik-dobersberg/angular/layout";
import { DisplayNamePipe, DurationPipe, ToDatePipe, ToUserPipe } from "@tierklinik-dobersberg/angular/pipes";
import { HlmSelectModule } from "@tierklinik-dobersberg/angular/select";
import { HlmSeparatorModule } from "@tierklinik-dobersberg/angular/separator";
import { HlmSheetModule } from "@tierklinik-dobersberg/angular/sheet";
import { HlmTableModule } from "@tierklinik-dobersberg/angular/table";
import { HlmTabsModule } from '@tierklinik-dobersberg/angular/tabs';
import { HlmTooltipModule } from "@tierklinik-dobersberg/angular/tooltip";
import { coerceDate } from "@tierklinik-dobersberg/angular/utils/date";
import { CommentTree, ListCommentsResponse } from "@tierklinik-dobersberg/apis/comment/v1";
import { FindOffTimeRequestsResponse, GetVacationCreditsLeftResponse, GetWorkTimeResponse, OffTimeEntry, OffTimeType, UserVacationSum, WorkTime } from "@tierklinik-dobersberg/apis/roster/v1";
import { addMonths, endOfMonth, isAfter, isBefore, isSameMonth, startOfMonth } from "date-fns";
import { MarkdownModule } from "ngx-markdown";
import { toast } from "ngx-sonner";
import { injectCurrentConfig } from 'src/app/api';
import { MyEditor } from 'src/app/ckeditor';
import { AppAvatarComponent } from "src/app/components/avatar";
import { CommentComponent } from "src/app/components/comment";
import { AppDateTableModule } from "src/app/components/date-table";
import { TkdPaginationComponent } from "src/app/components/pagination";
import { TextInputComponent } from "src/app/components/text-input";
import { AppSheetTriggerDirective } from "src/app/components/triggers";
import { UserColorVarsDirective } from "src/app/components/user-color-vars";
import { HeaderTitleService } from "src/app/layout/header-title";
import { usePaginationManager } from "src/app/utils/pagination-manager";
import { OffTimeCalendarOverviewComponent } from "../offtime-calendar-overview/calendar-overview";
import { MatchingOfftimePipe } from "../pipes/matching-offtime.pipe";
import { AppOffTimeFilterSheetComponent, filterOffTimeEntries, OffTimeFilter } from "./offtime-filter";


@Component({
  templateUrl: './offtime-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  styles: [
    `
        #offtime-tab-set ::ng-deep > .ant-tabs-nav {
          @apply px-4 bg-gray-100;
        }

        #offtime-tab-set ::ng-deep > .ant-tabs-nav .ant-tabs-tab {
          @apply w-40 justify-center;
        }
        `
  ],
  imports: [
    NgClass,
    DurationPipe,
    FormsModule,
    HlmTooltipModule,
    BrnTooltipModule,
    ToUserPipe,
    ToDatePipe,
    DisplayNamePipe,
    DatePipe,
    OffTimeCalendarOverviewComponent,
    HlmSheetModule,
    BrnSheetModule,
    CommentComponent,
    KeyValuePipe,
    HlmButtonDirective,
    HlmSelectModule,
    BrnSelectModule,
    RouterLink,
    TextInputComponent,
    AppSheetTriggerDirective,
    HlmAlertDialogModule,
    BrnAlertDialogModule,
    AppOffTimeFilterSheetComponent,
    HlmTabsModule,
    BrnTabsModule,
    AppDateTableModule,
    BrnTableModule,
    HlmTableModule,
    TkdEmptyTableComponent,
    CdkTableModule,
    AppAvatarComponent,
    HlmIconModule,
    MatchingOfftimePipe,
    HlmBadgeModule,
    UserColorVarsDirective,
    BrnHoverCardModule,
    HlmHoverCardModule,
    MarkdownModule,
    BrnSeparatorModule,
    HlmSeparatorModule,
    TkdPaginationComponent,
    HlmCardModule,
    HlmLabelDirective,
  ],
  providers: [
    ...provideIcons({lucideMessageCircle, lucideArrowLeft, lucideArrowRight, lucideCheckCircle, lucideCalendar, lucideXCircle}),
    BrnHoverCardContentService
  ]
})
export class OffTimeListComponent implements OnInit {
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly offTimeService = injectOfftimeService();
  private readonly worktimeService = injectWorktimeSerivce();
  private readonly commentService = injectCommentService();
  private readonly config = injectCurrentConfig();
  public readonly layout = inject(LayoutService);

  protected readonly currentUser = injectCurrentProfile();
  protected readonly Editor = MyEditor;


  protected readonly types = {
    [OffTimeType.UNSPECIFIED]: 'Beliebig',
    [OffTimeType.TIME_OFF]: 'Zeitausgleich',
    [OffTimeType.VACATION]: 'Urlaub',
  };

  protected readonly trackEntry: TrackByFunction<OffTimeEntry> = (_, e) => e.id
  protected readonly commentText = model('');
  protected readonly selectedEntry = signal<PartialMessage<OffTimeEntry> | null>(null);
  protected readonly comments = signal<CommentTree[]>([]);
  protected readonly profiles = injectUserProfiles();
  protected readonly entries = signal<OffTimeEntry[]>([]);
  protected readonly vacation = signal<UserVacationSum | null>(null);
  protected readonly worktime = signal< WorkTime | null >(null);
  protected readonly entryToDelete = signal<OffTimeEntry | null>(null);
  protected readonly filter = model<OffTimeFilter>();

  protected readonly hoveredEntryId = signal<string | null>(null);

  protected readonly _computedDisplayedColumns = computed(() => {
    const isMd = this.layout.md();
    
    if (isMd) {
      return [
        'from', 'to', 'user', 'description', 'actions'
      ];
    }
      return [
        'from', 'to', 'user', 'actions'
      ];
  })

  protected readonly _computedTotalCount = computed(() => this.entries().length)
  protected readonly _computedFilteredCount = computed(() => this._computedFilteredEntries().length)
  
  protected readonly _selectedMonth = signal<Date>(new Date());

  protected readonly _computedFilteredEntries = computed(() => {
    const filter = this.filter();
    const entries = this.entries();
    const month = this._selectedMonth();
    
    // wait for the first filter state
    if (!filter) {
      return [];
    }

    const result = filterOffTimeEntries(entries, filter);
    
    return result
      .filter(entry => {
        const from = coerceDate(entry.from);
        const to = coerceDate(entry.to);

        const monthStart = startOfMonth(month)
        const monthEnd = endOfMonth(month)

        if (isSameMonth(from, month) || isSameMonth(to, month)) {
          return true;
        }
        
        // show entries that span the complete month.
        if (isBefore(from, monthStart) && isAfter(to, monthEnd)) {
          return true ;
        }

        return false
      })
  })

  protected readonly paginator = usePaginationManager(this._computedFilteredEntries)
  
  protected readonly _computedCalendarRanges = computed(() => {
    const entries = this._computedFilteredEntries();
    const hovered = this.hoveredEntryId();
    
    const entry = entries.find(e => e.id === hovered);
    
    if (entry) {
      return [
        {
          id: 'highlight',
          from: entry.from,
          to: entry.to,
        }
      ]
    }
    
    return [];
  })

  switchDate(date: Date | null, offSet: number) {
    if (!date) {
      date = this._selectedMonth();
    }
    
    date = addMonths(date, offSet);
    
    this._selectedMonth.set(date);
  }
  
  protected readonly _loadEntriesEffect = effect(() => {
    const user = this.currentUser()

    if (!user) {
      return
    }

    untracked(() => {
      this.load(user.user.id)
    })
  }, { allowSignalWrites: true })

  protected readonly _loadCommentsEffect = effect(() => {
    const entry = this.selectedEntry();
    const config = this.config();

    this.commentText.set('')
    if (!entry) {
      this.comments.set([]);
      return
    }

    this.commentService
      .listComments({
        scope: config.UI?.OfftimeCommentScope,
        recurse: true,
        reference: entry.id,
        renderHtml: true
      })
      .catch(err => {
        const cerr = ConnectError.from(err);
        if (cerr.code !== Code.NotFound) {
          toast.error('Kommentare konnten nicht geladen werden', {
            description: cerr.message
          })
        }
        console.error(cerr);

        return new ListCommentsResponse()
      })
      .then(response => {
        this.comments.set(response.result);
      })
  }, {allowSignalWrites: true});
  
  protected createComment() {
    const comment = this.commentText();
    const commentEntry = this.selectedEntry();
    if (comment === '' || !commentEntry) {
      return;
    }

    this.commentService
      .createComment({
        content: comment,
        kind: {
          case: 'root',
          value: {
            reference: commentEntry.id,
            scope: this.config().UI?.OfftimeCommentScope,
          }
        },
      })
      .catch(err => {
        toast.error('Kommentar konnte nicht erstellt werden', {
          description: ConnectError.from(err).message
        })
      })
      .then(() => this.reloadComments())
  }

  ngOnInit(): void {
    this.headerTitle
      .set('Urlaubsanträge', 'Hier findest du eine Übersicht über deine Urlaubsanträge')
  }

  deleteRequest(req: OffTimeEntry) {
    this.entryToDelete.set(null);

    this.offTimeService
      .deleteOffTimeRequest({
        id: [req.id],
      })
      .then(() => {
        this.load(this.currentUser()?.user.id)
        toast.success('Antrag wurde erfolgreich gelöscht')
      })
      .catch(err => {
        toast.error('Antrag konnte nicht gelöscht werden', {description: ConnectError.from(err).message })
      })
  }

  protected reloadComments() {
    this.selectedEntry.set({...this.selectedEntry()});
  }

  load(userId: string) {
    const messageRef = toast.loading('Urlaubsanträge werden geladen', {
      dismissable: false,
      duration: 200000
    });

    const endOfYear = new Date(new Date().getFullYear()+1, 0, 1, 0, 0, 0, -1)

    this.worktimeService
      .getWorkTime({userIds: [userId]})
      .catch(err => {
        if (ConnectError.from(err).code !== Code.NotFound) {
          console.error(err);
        }

        return new GetWorkTimeResponse({results: []})
      })
      .then(response => {
        this.worktime.set(response.results?.find(result => result.userId === userId)?.current || null);
      })

    this.worktimeService
      .getVacationCreditsLeft({
        forUsers: {
          userIds: [userId]
        },
        until: Timestamp.fromDate(endOfYear),
      })
      .catch(err => {
        if (ConnectError.from(err).code !== Code.NotFound) {
          console.error(err);
        }

        return new GetVacationCreditsLeftResponse()
      })
      .then(response => {
        this.vacation.set(response.results.find(sum => sum.userId === userId) || null);
      })

    this.offTimeService
      .findOffTimeRequests({})
      .catch(err => {
        const cerr = ConnectError.from(err);
        if (cerr.code !== Code.NotFound) {
          toast.error('Urlaubsanträge konnte nicht geladen werden', {
            description: cerr.message,
          })
        }

        return new FindOffTimeRequestsResponse()
      })
      .then(response => {

        this.entries.set(response.results)
          
        toast.dismiss(messageRef)
      })
  }
}
