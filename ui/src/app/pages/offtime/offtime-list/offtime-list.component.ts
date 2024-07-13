import { DatePipe, KeyValuePipe, NgClass } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, effect, inject, model, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { PartialMessage, Timestamp } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { BrnAlertDialogModule } from "@spartan-ng/ui-alertdialog-brain";
import { BrnSelectModule } from "@spartan-ng/ui-select-brain";
import { BrnSheetModule } from "@spartan-ng/ui-sheet-brain";
import { BrnTooltipModule } from "@spartan-ng/ui-tooltip-brain";
import { HlmAlertDialogModule } from "@tierklinik-dobersberg/angular/alertdialog";
import { injectCurrentProfile, injectUserProfiles } from "@tierklinik-dobersberg/angular/behaviors";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { LayoutService } from "@tierklinik-dobersberg/angular/layout";
import { DisplayNamePipe, DurationPipe, ToDatePipe, ToUserPipe } from "@tierklinik-dobersberg/angular/pipes";
import { HlmSelectModule } from "@tierklinik-dobersberg/angular/select";
import { HlmSheetModule } from "@tierklinik-dobersberg/angular/sheet";
import { HlmTooltipModule } from "@tierklinik-dobersberg/angular/tooltip";
import { CommentTree, FindOffTimeRequestsResponse, GetVacationCreditsLeftResponse, GetWorkTimeResponse, ListCommentsResponse, OffTimeEntry, OffTimeType, UserVacationSum, WorkTime } from '@tierklinik-dobersberg/apis';
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzTableModule } from "ng-zorro-antd/table";
import { NzTabsModule } from "ng-zorro-antd/tabs";
import { MarkdownModule } from "ngx-markdown";
import { toast } from "ngx-sonner";
import { ConfigAPI } from 'src/app/api';
import { COMMENT_SERVICE, OFFTIME_SERVICE, WORKTIME_SERVICE } from "src/app/api/connect_clients";
import { MyEditor } from 'src/app/ckeditor';
import { AppSheetTriggerDirective } from "src/app/components/sheet-trigger";
import { HeaderTitleService } from "src/app/layout/header-title";
import { CommentComponent } from "src/app/shared/comment";
import { TextInputComponent } from "src/app/shared/text-input";
import { OffTimeCalendarOverviewComponent } from "../offtime-calendar-overview/calendar-overview";
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
    NzSelectModule,
    DurationPipe,
    FormsModule,
    NzTabsModule,
    NzTableModule,
    MarkdownModule,
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
  ]
})
export class OffTimeListComponent implements OnInit {
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly offTimeService = inject(OFFTIME_SERVICE);
  private readonly worktimeService = inject(WORKTIME_SERVICE);
  private readonly commentService = inject(COMMENT_SERVICE);
  private readonly configService = inject(ConfigAPI);
  private readonly currentUser = injectCurrentProfile();
  public readonly layout = inject(LayoutService);

  protected readonly Editor = MyEditor;


  protected readonly types = {
    [OffTimeType.UNSPECIFIED]: 'Beliebig',
    [OffTimeType.TIME_OFF]: 'Zeitausgleich',
    [OffTimeType.VACATION]: 'Urlaub',
  };

  protected readonly commentText = model('');
  protected readonly selectedEntry = signal<PartialMessage<OffTimeEntry> | null>(null);
  protected readonly comments = signal<CommentTree[]>([]);
  protected readonly profiles = injectUserProfiles();
  protected readonly entries = signal<OffTimeEntry[]>([]);
  protected readonly vacation = signal<UserVacationSum | null>(null);
  protected readonly worktime = signal< WorkTime | null >(null);
  protected readonly entryToDelete = signal<OffTimeEntry | null>(null);
  protected readonly filter = model<OffTimeFilter>();

  protected readonly _computedFilteredEntries = computed(() => {
    const filter = this.filter();
    const entries = this.entries();
    
    // wait for the first filter state
    if (!filter) {
      return [];
    }

    console.log("applying filter", filter)
    
    const result = filterOffTimeEntries(entries, filter);
    
    console.log("filtered result", result)

    return result;
  })

  protected readonly _loadCommentsEffect = effect(() => {
    const entry = this.selectedEntry();

    this.commentText.set('')
    if (!entry) {
      this.comments.set([]);
      return
    }

    this.commentService
      .listComments({
        scope: this.configService.current.UI?.OfftimeCommentScope,
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
            scope: this.configService.current.UI?.OfftimeCommentScope,
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

    this.load();
  }

  deleteRequest(req: OffTimeEntry) {
    this.entryToDelete.set(null);

    this.offTimeService
      .deleteOffTimeRequest({
        id: [req.id],
      })
      .then(() => {
        this.load()
        toast.success('Antrag wurde erfolgreich gelöscht')
      })
      .catch(err => {
        toast.error('Antrag konnte nicht gelöscht werden', {description: ConnectError.from(err).message })
      })
  }

  protected reloadComments() {
    this.selectedEntry.set({...this.selectedEntry()});
  }

  load() {
    const messageRef = toast.loading('Urlaubsanträge werden geladen');
    const userId = this.currentUser()?.user?.id; 
    
    if (!userId) {
      return;
    }

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
