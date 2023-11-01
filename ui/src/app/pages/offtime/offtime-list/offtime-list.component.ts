import { NzModalService } from 'ng-zorro-antd/modal';
import { Timestamp } from '@bufbuild/protobuf';
import { ConnectError, Code } from '@bufbuild/connect';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, TrackByFunction, inject } from "@angular/core";
import { OFFTIME_SERVICE, WORKTIME_SERVICE } from "src/app/api/connect_clients";
import { ProfileService } from "src/app/services/profile.service";
import { HeaderTitleService } from "src/app/shared/header-title";
import { FindOffTimeRequestsResponse, GetVacationCreditsLeftResponse, OffTimeEntry, OffTimeType, UserVacationSum } from '@tkd/apis';
import { LayoutService } from 'src/app/services';
import { NzMessageService } from 'ng-zorro-antd/message';

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
})
export class OffTimeListComponent implements OnInit {
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly offTimeService = inject(OFFTIME_SERVICE);
  private readonly worktimeService = inject(WORKTIME_SERVICE);
  private readonly profileService = inject(ProfileService);
  private readonly messageService = inject(NzMessageService);
  private readonly modalService = inject(NzModalService)
  private readonly cdr = inject(ChangeDetectorRef)

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

  entries: OffTimeEntry[] = [];

  filterState: FilterState = FilterState.All
  vacation: UserVacationSum | null = null;

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
