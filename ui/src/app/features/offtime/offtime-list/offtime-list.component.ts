import { CdkTableModule } from '@angular/cdk/table';
import { DatePipe, NgClass, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  model,
  OnInit,
  signal,
  untracked
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PartialMessage, Timestamp } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import {
  lucideArrowLeft,
  lucideArrowRight,
  lucideCalendar,
  lucideCircleCheck
} from '@ng-icons/lucide';
import { BrnAlertDialogModule } from '@spartan-ng/ui-alertdialog-brain';
import {
  BrnHoverCardContentService,
  BrnHoverCardModule,
} from '@spartan-ng/ui-hovercard-brain';
import { BrnSelectModule } from '@spartan-ng/ui-select-brain';
import { BrnSeparatorModule } from '@spartan-ng/ui-separator-brain';
import { BrnSheetModule } from '@spartan-ng/ui-sheet-brain';
import { BrnTableModule } from '@spartan-ng/ui-table-brain';
import { BrnTabsModule } from '@spartan-ng/ui-tabs-brain';
import { BrnTooltipModule } from '@spartan-ng/ui-tooltip-brain';
import { HlmAlertDialogModule } from '@tierklinik-dobersberg/angular/alertdialog';
import { HlmBadgeModule } from '@tierklinik-dobersberg/angular/badge';
import {
  injectUserProfiles,
  sortProtoTimestamps
} from '@tierklinik-dobersberg/angular/behaviors';
import { HlmButtonDirective } from '@tierklinik-dobersberg/angular/button';
import { HlmCardModule } from '@tierklinik-dobersberg/angular/card';
import {
  injectCommentService,
  injectOfftimeService,
  injectWorktimeSerivce,
} from '@tierklinik-dobersberg/angular/connect';
import { TkdEmptyTableComponent } from '@tierklinik-dobersberg/angular/empty-table';
import { HlmHoverCardModule } from '@tierklinik-dobersberg/angular/hovercard';
import {
  HlmIconModule,
  provideIcons,
} from '@tierklinik-dobersberg/angular/icon';
import { LayoutService } from '@tierklinik-dobersberg/angular/layout';
import {
  DisplayNamePipe,
  DurationPipe,
  ToDatePipe,
  ToUserPipe,
} from '@tierklinik-dobersberg/angular/pipes';
import { HlmSelectModule } from '@tierklinik-dobersberg/angular/select';
import { HlmSeparatorModule } from '@tierklinik-dobersberg/angular/separator';
import { HlmSheetModule } from '@tierklinik-dobersberg/angular/sheet';
import { HlmTableModule } from '@tierklinik-dobersberg/angular/table';
import { HlmTabsModule } from '@tierklinik-dobersberg/angular/tabs';
import { HlmTooltipModule } from '@tierklinik-dobersberg/angular/tooltip';
import { coerceDate } from '@tierklinik-dobersberg/angular/utils/date';
import {
  CommentTree,
  ListCommentsResponse,
} from '@tierklinik-dobersberg/apis/comment/v1';
import {
  FindOffTimeRequestsResponse,
  GetVacationCreditsLeftResponse,
  GetWorkTimeResponse,
  OffTimeEntry,
  OffTimeType,
  UserVacationSum,
  WorkTime,
} from '@tierklinik-dobersberg/apis/roster/v1';
import {
  addMonths,
  endOfMonth,
  isAfter,
  isBefore,
  isSameMonth,
  startOfMonth,
} from 'date-fns';
import { MarkdownModule } from 'ngx-markdown';
import { toast } from 'ngx-sonner';
import { MyEditor } from 'src/app/ckeditor';
import { AppAvatarComponent } from 'src/app/components/avatar';
import { CommentComponent } from 'src/app/components/comment';
import { AppDateTableModule } from 'src/app/components/date-table';
import { TextInputComponent } from 'src/app/components/text-input';
import { UserColorVarsDirective } from 'src/app/components/user-color-vars';
import { HeaderTitleService } from 'src/app/layout/header-title';
import { injectStoredConfig, injectStoredProfile } from 'src/app/utils/inject-helpers';
import { OfftimeEntryHistoryComponent } from '../offtime-entry-history/offtime-entry-history.component';
import { Column, OfftimeTableComponent } from '../offtime-table/offtime-table.component';
import { MatchingOfftimePipe } from '../pipes/matching-offtime.pipe';
import {
  AppOffTimeFilterSheetComponent,
  filterOffTimeEntries,
  OffTimeFilter,
} from './offtime-filter';

@Component({
  templateUrl: './offtime-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
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
    HlmSheetModule,
    BrnSheetModule,
    CommentComponent,
    HlmButtonDirective,
    HlmSelectModule,
    BrnSelectModule,
    RouterLink,
    TextInputComponent,
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
    HlmCardModule,
    OfftimeTableComponent,
    NgTemplateOutlet,
    OfftimeEntryHistoryComponent,
  ],
  providers: [
    ...provideIcons({
      lucideArrowLeft,
      lucideArrowRight,
      lucideCircleCheck,
      lucideCalendar,
    }),
    BrnHoverCardContentService,
  ],
})
export class OffTimeListComponent implements OnInit {
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly offTimeService = injectOfftimeService();
  private readonly worktimeService = injectWorktimeSerivce();
  private readonly commentService = injectCommentService();
  private readonly config = injectStoredConfig();
  public readonly layout = inject(LayoutService);

  protected readonly currentUser = injectStoredProfile();
  protected readonly Editor = MyEditor;

  protected readonly types = {
    [OffTimeType.UNSPECIFIED]: 'Beliebig',
    [OffTimeType.TIME_OFF]: 'Zeitausgleich',
    [OffTimeType.VACATION]: 'Urlaub',
  };

  protected readonly commentText = model('');
  protected readonly selectedEntry =
    signal<PartialMessage<OffTimeEntry> | null>(null);
  protected readonly comments = signal<CommentTree[]>([]);
  protected readonly profiles = injectUserProfiles();
  protected readonly entries = signal<OffTimeEntry[]>([]);
  protected readonly vacation = signal<UserVacationSum | null>(null);
  protected readonly worktime = signal<WorkTime | null>(null);
  protected readonly entryToDelete = signal<OffTimeEntry | null>(null);
  protected readonly filter = model<OffTimeFilter>();
  protected readonly lastAppliedCost = signal<Date |  null>(null)

  protected readonly currentUserEntries = signal<OffTimeEntry[]>([])

  protected readonly hoveredEntry = signal<OffTimeEntry | null>(null);

  protected readonly _computedDisplayedColumns = computed<Column[]>(() => {
    const isMd = this.layout.md();

    if (isMd) {
      return ['approval', 'from', 'to', 'user', 'description', 'actions'];
    }

    return ['approval', 'from', 'to', 'user', 'actions'];
  });

  protected readonly _computedTotalCount = computed(
    () => this.entries().length
  );

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

    return result.filter(entry => {
      const from = coerceDate(entry.from);
      const to = coerceDate(entry.to);

      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);

      if (isSameMonth(from, month) || isSameMonth(to, month)) {
        return true;
      }

      // show entries that span the complete month.
      if (isBefore(from, monthStart) && isAfter(to, monthEnd)) {
        return true;
      }

      return false;
    });
  });

  protected readonly _computedCalendarRanges = computed(() => {
    const entry = this.hoveredEntry();

    if (entry) {
      return [
        {
          id: 'highlight',
          from: entry.from,
          to: entry.to,
        },
      ];
    }

    return [];
  });

  switchDate(date: Date | null, offSet: number) {
    if (!date) {
      date = this._selectedMonth();
    }

    date = addMonths(date, offSet);

    this._selectedMonth.set(date);
  }

  protected readonly _loadEntriesEffect = effect(
    () => {
      const user = this.currentUser();
      const date = this._selectedMonth();

      if (!user) {
        return;
      }

      untracked(() => {
        console.log('loading offitme entries');
        this.load(user.user.id, date);
      });
    },
    { allowSignalWrites: true }
  );

  protected readonly _loadCommentsEffect = effect(
    () => {
      const entry = this.selectedEntry();
      const config = this.config();

      this.commentText.set('');
      if (!entry) {
        this.comments.set([]);
        return;
      }

      this.commentService
        .listComments({
          scope: config.UI?.OfftimeCommentScope,
          recurse: true,
          reference: entry.id,
          renderHtml: true,
        })
        .catch(err => {
          const cerr = ConnectError.from(err);
          if (cerr.code !== Code.NotFound) {
            toast.error('Kommentare konnten nicht geladen werden', {
              description: cerr.message,
            });
          }
          console.error(cerr);

          return new ListCommentsResponse();
        })
        .then(response => {
          this.comments.set(response.result);
        });
    },
    { allowSignalWrites: true }
  );

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
          },
        },
      })
      .catch(err => {
        toast.error('Kommentar konnte nicht erstellt werden', {
          description: ConnectError.from(err).message,
        });
      })
      .then(() => this.reloadComments());
  }

  ngOnInit(): void {
    this.headerTitle.set(
      'Urlaubsanträge',
      'Hier findest du eine Übersicht über deine Urlaubsanträge'
    );
  }

  deleteRequest(req: OffTimeEntry) {
    this.entryToDelete.set(null);

    this.offTimeService
      .deleteOffTimeRequest({
        id: [req.id],
      })
      .then(() => {
        this.load(this.currentUser()?.user.id, this._selectedMonth());
        toast.success('Antrag wurde erfolgreich gelöscht');
      })
      .catch(err => {
        toast.error('Antrag konnte nicht gelöscht werden', {
          description: ConnectError.from(err).message,
        });
      });
  }

  protected reloadComments() {
    this.selectedEntry.set({ ...this.selectedEntry() });
  }

  load(userId: string, date: Date) {
    const messageRef = toast.loading('Urlaubsanträge werden geladen', {
      dismissable: false,
      duration: 200000,
    });

    const endOfYear = new Date(new Date().getFullYear() + 1, 0, 1, 0, 0, 0, -1);

    this.worktimeService
      .getWorkTime({ userIds: [userId] })
      .catch(err => {
        if (ConnectError.from(err).code !== Code.NotFound) {
          console.error(err);
        }

        return new GetWorkTimeResponse({ results: [] });
      })
      .then(response => {
        this.worktime.set(
          response.results?.find(result => result.userId === userId)?.current ||
            null
        );
      });

    this.worktimeService
      .getVacationCreditsLeft({
        forUsers: {
          userIds: [userId],
        },
        until: Timestamp.fromDate(endOfYear),
        analyze: true,
      })
      .catch(err => {
        if (ConnectError.from(err).code !== Code.NotFound) {
          console.error(err);
        }

        return new GetVacationCreditsLeftResponse();
      })
      .then(response => {
        this.vacation.set(
          response.results.find(sum => sum.userId === userId) || null
        );

        let last: Timestamp | null = null;
        this.vacation()
          ?.analysis
            ?.slices
            ?.forEach(sum => {
              sum.costs
                ?.forEach(cost => {
                  if (last === null || cost.date?.seconds > last.seconds) {
                    last = cost.date;
                  }
                })
            }) 

        if (last) {
          this.lastAppliedCost.set(coerceDate(last))
        }
      });

    this.offTimeService
      .findOffTimeRequests({
        userIds: [
          userId
        ],
      })
      .catch(err => {
        const cerr = ConnectError.from(err);
        if (cerr.code !== Code.NotFound) {
          toast.error('Urlaubsanträge konnte nicht geladen werden', {
            description: cerr.message,
          });
        }

        return new FindOffTimeRequestsResponse();
      })
      .then(response => {
        this.currentUserEntries.set(
          (response.results || [])
            .sort((a, b) => sortProtoTimestamps(a.createdAt, b.createdAt))
        );
      })

    this.offTimeService
      .findOffTimeRequests({
        from: Timestamp.fromDate(startOfMonth(date)),
        to: Timestamp.fromDate(endOfMonth(date)),
      })
      .catch(err => {
        const cerr = ConnectError.from(err);
        if (cerr.code !== Code.NotFound) {
          toast.error('Urlaubsanträge konnte nicht geladen werden', {
            description: cerr.message,
          });
        }

        return new FindOffTimeRequestsResponse();
      })
      .then(response => {
        this.entries.set(response.results || []);
      })
      .finally(() => {
        toast.dismiss(messageRef);
      });
  }
}
