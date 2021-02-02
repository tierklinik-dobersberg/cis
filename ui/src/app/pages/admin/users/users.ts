import { Component, OnDestroy, OnInit } from "@angular/core";
import { IdentityAPI, ProfileWithAvatar } from "src/app/api";
import { LayoutService } from "src/app/layout.service";

@Component({
    templateUrl: './users.html',
    styleUrls: ['./users.scss']
})
export class UserListComponent implements OnInit, OnDestroy {
    expandSet = new Set<string>();

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
        public layout: LayoutService,
    ) { }

    ngOnInit() {
        this.identityapi.listUsers({ includeAvatars: true })
            .subscribe(profiles => this.profiles = profiles);
    }

    ngOnDestroy() {

    }
}