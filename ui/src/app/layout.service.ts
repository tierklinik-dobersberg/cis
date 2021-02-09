import { BreakpointObserver, Breakpoints } from "@angular/cdk/layout";
import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";
import { map } from "rxjs/operators";



@Injectable({
    providedIn: 'root'
})
export class LayoutService {
    breakpoints: Observable<{ [key: string]: boolean }>;

    private _onUpdate = new BehaviorSubject<void>(undefined);

    get change() {
        return this._onUpdate.asObservable();
    }

    get drawerWidth(): Observable<string> {
        return this.change
            .pipe(map(() => {
                return this.isPhone
                    ? '100vw'
                    : this.isDesktopUp
                        ? '25vw'
                        : '50vw';
            }))
    }

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

            this._onUpdate.next();
        });
    }
}