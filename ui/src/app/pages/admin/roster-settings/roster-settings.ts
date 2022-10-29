import { ChangeDetectionStrategy, Component, OnInit } from "@angular/core";
import { HeaderTitleService } from "src/app/shared/header-title";

@Component({
    selector: 'tkd-roster-settings',
    templateUrl: './roster-settings.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TkdRosterSettingsComponent implements OnInit {
    constructor(
        private headerService: HeaderTitleService
    ) {}

    ngOnInit(): void {
        this.headerService.set(
            'Diensplan / Urlaubsanträge', 
            'Verwalte Dienstplan Einstellungen und Urlaubsanträge',
            null,
            [
                {name: 'Administration', route: '/admin'},
            ],
        )
    }
}

