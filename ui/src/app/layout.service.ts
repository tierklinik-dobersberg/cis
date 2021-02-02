import { BreakpointObserver, Breakpoints } from "@angular/cdk/layout";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";



@Injectable({
    providedIn: 'root'
})
export class LayoutService {
    breakpoints: Observable<{ [key: string]: boolean }>;

    isPhone = false;
    isTabletPortraitUp = false;
    isTabletLandscapeUp = false;
    isDesktopUp = false;
    isBigDesktopUp = false;

    constructor(private breakpointObserver: BreakpointObserver) {
        this.breakpoints = this.breakpointObserver.observe([
            '(max-width: 599px)',
            '(min-width: 600px)',
            '(min-width: 900px)',
            '(min-width: 1200px)',
            '(min-width: 1800px)',
        ])
            .pipe(map(breakpointState => {
                return breakpointState.breakpoints;
            }));

        this.breakpoints.subscribe(states => {
            this.isPhone = states['(max-width: 599px)'];
            this.isTabletPortraitUp = states['(min-width: 600px)'];
            this.isTabletLandscapeUp = states['(min-width: 900px)']
            this.isDesktopUp = states['(min-width: 1200px)']
            this.isBigDesktopUp = states['(min-width: 1800px)']
        });
    }
}