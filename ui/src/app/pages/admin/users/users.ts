import { Component, OnDestroy, OnInit } from "@angular/core";
import { filter } from "rxjs/operators";
import { ConfigAPI, IdentityAPI, ProfileWithAvatar, UserProperty } from "src/app/api";
import { LayoutService } from "src/app/layout.service";

@Component({
    templateUrl: './users.html',
    styleUrls: ['./users.scss']
})
export class UserListComponent implements OnInit, OnDestroy {
    expandSet = new Set<string>();
    userProps: UserProperty[] = [];

    onExpandChange(id: string, checked: boolean): void {
        if (checked) {
            this.expandSet.add(id);
        } else {
            this.expandSet.delete(id);
        }
    }

    profiles: ProfileWithAvatar[] = [];

    constructor(
        private identityapi: IdentityAPI,
        private configapi: ConfigAPI,
        public layout: LayoutService,
    ) { }

    ngOnInit() {
        this.configapi.change
            .pipe(filter(cfg => !!cfg))
            .subscribe(cfg => {
                this.userProps = (cfg.UserProperties || []).filter(prop => prop.visibility === 'public')
            });

        this.identityapi.listUsers({ includeAvatars: true })
            .subscribe(profiles => this.profiles = profiles);
    }

    ngOnDestroy() {

    }
}