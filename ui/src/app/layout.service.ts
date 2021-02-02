import { BreakpointObserver, Breakpoints } from "@angular/cdk/layout";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

@Injectable({
    providedIn: 'root'
})
export class LayoutService {
    phone$: Observable<boolean>;

    isPhone: boolean

    constructor(private breakpointObserver: BreakpointObserver) {
        this.phone$ = this.breakpointObserver.observe('(max-width: 599px)')
            .pipe(map(breakpointState => {
                return breakpointState.matches;
            }));

        this.phone$.subscribe(isPhone => {
            this.isPhone = isPhone;
        });
    }
}