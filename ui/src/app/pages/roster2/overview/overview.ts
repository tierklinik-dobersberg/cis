import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, TrackByFunction } from "@angular/core";
import { NzMessageService } from 'ng-zorro-antd/message';
import { Roster2Service, RosterMeta } from "src/app/api/roster2";
import { extractErrorMessage } from 'src/app/utils';
import { HeaderTitleService } from './../../../shared/header-title/header.service';

@Component({
    selector: 'tkd-roster-overview',
    templateUrl: './overview.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TkdRosterOverviewComponent implements OnInit {
    rosters: RosterMeta[] = [];

    nextMonth: number;
    nextYear: number;

    trackRoster: TrackByFunction<RosterMeta> = (_, r) => r.id!;

    constructor(
        private roster2: Roster2Service,
        private nzMessage: NzMessageService,
        private titleService: HeaderTitleService,
        private cdr: ChangeDetectorRef
    ) {
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth()+1, 1)
      this.nextMonth = nextMonth.getMonth() + 1
      this.nextYear = nextMonth.getFullYear()
    }

    ngOnInit(): void {
      this.titleService.set(
        'Dienstpläne',
        'Erstelle und Verwalte die Dienstpläne',
      )

      this.load();
    }

    load(): void {
        this.roster2
            .roster
            .list()
            .subscribe(meta => {
                this.rosters = meta;
                this.cdr.markForCheck();
            })
    }

  deleteRoster(row: RosterMeta) {
    this.roster2
      .roster
      .delete(row.id!)
      .subscribe({
        next: () => {
          this.load();
        },
        error: err => {
          this.nzMessage.error(extractErrorMessage(err, 'Dienstplan konnte nicht gelöscht werden'))
        }
      })
  }
}
