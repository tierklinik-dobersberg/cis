import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, TrackByFunction, inject } from "@angular/core";
import { Timestamp } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { CommentTree, FindOffTimeRequestsResponse, GetVacationCreditsLeftResponse, GetWorkTimeResponse, ListCommentsResponse, OffTimeEntry, OffTimeType, Profile, UserVacationSum, WorkTime } from '@tierklinik-dobersberg/apis';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { ConfigAPI, UserService } from 'src/app/api';
import { COMMENT_SERVICE, OFFTIME_SERVICE, WORKTIME_SERVICE } from "src/app/api/connect_clients";
import { MyEditor } from 'src/app/ckeditor';
import { HeaderTitleService } from "src/app/layout/header-title";
import { LayoutService } from 'src/app/services';
import { ProfileService } from "src/app/services/profile.service";

enum FilterState {
  All,
  OnlyNew,
}

const filterFuncs = {
  [FilterState.All]: () => true,
  [FilterState.OnlyNew]: (entry: OffTimeEntry) => {
    const now = new Date().getTime();
    return entry.from.toDate().getTime() >= now || entry.to.toDate().getTime() >= now;
  },
}

@Component({
  templateUrl: './offtime-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
        #offtime-tab-set ::ng-deep > .ant-tabs-nav {
          @apply px-4 bg-gray-100;
        }

        #offtime-tab-set ::ng-deep > .ant-tabs-nav .ant-tabs-tab {
          @apply w-40 justify-center;
        }
        `
  ]
})
export class OffTimeListComponent implements OnInit {
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly offTimeService = inject(OFFTIME_SERVICE);
  private readonly worktimeService = inject(WORKTIME_SERVICE);
  private readonly commentService = inject(COMMENT_SERVICE);
  private readonly configService = inject(ConfigAPI);
  private readonly profileService = inject(ProfileService);
  private readonly usersService = inject(UserService)
  private readonly messageService = inject(NzMessageService);
  private readonly modalService = inject(NzModalService)
  private readonly cdr = inject(ChangeDetectorRef)

  public readonly Editor = MyEditor;
  public readonly layout = inject(LayoutService).withAutoUpdate(this.cdr);
  public readonly possibleFilters = {
    [FilterState.All]: 'Alle',
    [FilterState.OnlyNew]: 'Nur Neue'
  };
  public readonly types = {
    [OffTimeType.UNSPECIFIED]: 'Beliebig',
    [OffTimeType.TIME_OFF]: 'Zeitausgleich',
    [OffTimeType.VACATION]: 'Urlaub',
  };

  newCommentText = ''
  showEntryComments: OffTimeEntry | null = null;
  comments: CommentTree[] = [];
  profiles: Profile[] = [];

  createComment() {
    if (this.newCommentText === '' || !this.showEntryComments) {
      return;
    }

    this.commentService
      .createComment({
        content: this.newCommentText,
        kind: {
          case: 'root',
          value: {
            reference: this.showEntryComments.id,
            scope: this.configService.current.UI?.OfftimeCommentScope,
          }
        },
      })
      .catch(err => {
        this.messageService.error('Kommentar konnte nicht erstellt werden: ' + ConnectError.from(err).rawMessage)
      })
      .then(() => {
        // reload
        this.loadEntryComments(this.showEntryComments)
      })
  }

  loadEntryComments(entry: OffTimeEntry) {
    this.commentService
      .listComments({
        scope: this.configService.current.UI?.OfftimeCommentScope,
        recurse: true,
        reference: entry.id,
        renderHtml: true
      })
      .catch(err => {
        return new ListCommentsResponse()
      })
      .then(response => {
        this.comments = response.result;

        this.showEntryComments = entry;
        this.newCommentText = '';

        this.cdr.markForCheck();
      })
  }

  entries: OffTimeEntry[] = [];

  filterState: FilterState = FilterState.All
  vacation: UserVacationSum | null = null;
  worktime: WorkTime | null = null;

  trackEntry: TrackByFunction<OffTimeEntry> = (_, entry) => entry.id

  ngOnInit(): void {
    this.headerTitle
      .set('Urlaubsanträge', 'Hier findest du eine Übersicht über deine Urlaubsanträge')

    this.load();
  }

  deleteRequest(req: OffTimeEntry) {
    this.modalService
      .confirm({
        nzTitle: 'Antrag löschen',
        nzContent: 'Möchtest du den Urlaubsantrag wirklich löschen',
        nzOkText: 'Ja, Löschen',
        nzOkDanger: true,
        nzCancelText: 'Nein',
        nzOnOk: () => {
          this.offTimeService
            .deleteOffTimeRequest({
              id: [req.id],
            })
            .then(() => {
              this.load()
              this.messageService.success('Antrag wurde erfolgreich gelöscht')
            })
            .catch(err => {
              this.messageService.error('Antrag konnte nicht gelöscht werden: ' + ConnectError.from(err).rawMessage)
            })
        }
      })
  }

  load() {
    const messageRef = this.messageService.loading('Anträge werden geladen');
    const endOfYear = new Date(new Date().getFullYear()+1, 0, 1, 0, 0, 0, -1)

    this.profiles = this.usersService.snapshot;

    this.worktimeService
      .getWorkTime({userIds: [this.profileService.id]})
      .catch(err => {
        if (ConnectError.from(err).code !== Code.NotFound) {
          console.error(err);
        }

        return new GetWorkTimeResponse({results: []})
      })
      .then(response => {
        this.worktime = response.results?.find(result => result.userId === this.profileService.id)?.current || null;

        this.cdr.markForCheck();
      })

    this.worktimeService
      .getVacationCreditsLeft({
        forUsers: {
          userIds: [this.profileService.snapshot.user.id]
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
        this.vacation = response.results.find(sum => sum.userId === this.profileService.snapshot.user.id) || null;

        this.cdr.markForCheck();
      })

    this.offTimeService
      .findOffTimeRequests({
        userIds: [
          this.profileService.snapshot.user.id
        ],
      })
      .catch(err => {
        if (ConnectError.from(err).code !== Code.NotFound) {
          console.error(err);
        }

        return new FindOffTimeRequestsResponse()
      })
      .then(response => {
        let filterFunc = filterFuncs[this.filterState];
        if (!filterFunc) {
          filterFunc = filterFunc[FilterState.All]
        }

        this.entries = response.results
          .filter(entry => entry.requestorId === this.profileService.snapshot.user.id)
          .filter(filterFunc)

        this.messageService.remove(messageRef.messageId);
        this.cdr.markForCheck();
      })
  }
}
