import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, TrackByFunction } from "@angular/core";
import { Roster2Service, RosterMeta } from "src/app/api/roster2";

@Component({
    selector: 'tkd-roster-overview',
    templateUrl: './overview.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TkdRosterOverviewComponent implements OnInit {
    rosters: RosterMeta[] = [];

    trackRoster: TrackByFunction<RosterMeta> = (_, r) => r.id!;

    constructor(
        private roster2: Roster2Service,
        private cdr: ChangeDetectorRef
    ) {}

    ngOnInit(): void {
        this.roster2
            .roster
            .list()
            .subscribe(meta => {
                this.rosters = meta;
                this.cdr.markForCheck();
            })
    }
}