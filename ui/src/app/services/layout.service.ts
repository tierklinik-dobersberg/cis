import { BreakpointObserver } from '@angular/cdk/layout';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import { ChangeDetectorRef, Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
@Injectable({
  providedIn: 'root'
})
export class LayoutService {
  breakpoints: Observable<{ [key: string]: boolean }>;

  private onUpdate = new BehaviorSubject<void>(undefined);

  get change(): Observable<void> {
    return this.onUpdate.asObservable();
  }

  get drawerWidth(): Observable<string> {
    return this.change
      .pipe(map(() => {
        return this.isPhone
          ? '100vw'
          : this.isDesktopUp
            ? '25vw'
            : '50vw';
      }));
  }

  /** Automatically adds an update listener to trigger a change detection cycle.
   *  Must be executed from an injection context.
   */
  withAutoUpdate(cdr?: ChangeDetectorRef): this {
    cdr = cdr || inject(ChangeDetectorRef);

    this.change
      .pipe(takeUntilDestroyed())
      .subscribe(() => cdr.markForCheck())

    return this
  }

  isPhone = false;
  isTabletPortraitUp = false;
  isTabletLandscapeUp = false;
  isDesktopUp = false;
  isBigDesktopUp = false;

  get isTablet() {
    return this.isTabletPortraitUp && !this.isDesktopUp
  }

  get isTablePortrait() {
    return this.isTabletPortraitUp && !this.isTabletLandscapeUp
  }

  get isTableLandscape() {
    return this.isTabletLandscapeUp && !this.isDesktopUp
  }

  constructor(
    private breakpointObserver: BreakpointObserver
  ) {
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
      this.isTabletLandscapeUp = states['(min-width: 900px)'];
      this.isDesktopUp = states['(min-width: 1200px)'];
      this.isBigDesktopUp = states['(min-width: 1800px)'];

      this.onUpdate.next();
    });
  }
}
