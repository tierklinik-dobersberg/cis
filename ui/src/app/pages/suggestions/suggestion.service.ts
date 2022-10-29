import { Injectable } from '@angular/core';
import { TkdAccountService } from '@tkd/api';
import { BehaviorSubject, combineLatest, interval, Observable, of } from 'rxjs';
import { delay, map, mergeMap, retryWhen, startWith, switchMap } from 'rxjs/operators';
import { CustomerAPI, CustomerRef, Suggestion } from 'src/app/api/customer.api';

const pollDelay = 10 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class SuggestionService {
  private _reload: BehaviorSubject<void> = new BehaviorSubject(undefined);
  private _suggestions: BehaviorSubject<Suggestion[]> = new BehaviorSubject([]);

  constructor(
    private customerapi: CustomerAPI,
    private account: TkdAccountService,
  ) {

    this.account.profileChange
      .pipe(
        switchMap(profile => {
          if (profile === null) {
            return of([] as Suggestion[]);
          }
          const poll$ = interval(pollDelay).pipe(startWith(-1))
          return combineLatest([poll$, this._reload])
            .pipe(
              mergeMap(() => this.customerapi.getSuggestions({ limit: 100 })),
              retryWhen(err => err.pipe(delay(pollDelay)))
            )
        })
      )
      .subscribe(suggestions => this._updateSuggestions(suggestions));

  }

  private _updateSuggestions(suggestions: Suggestion[]) {
    this._suggestions.next(suggestions || []);
  }

  get first(): Suggestion | null {
    return this._suggestions.getValue()[0] || null;
  }

  get first$(): Observable<Suggestion | null> {
    return this._suggestions.pipe(
      map(sug => sug[0] || null)
    )
  }

  get count$(): Observable<number> {
    return this._suggestions.pipe(map(res => res.length))
  }

  reload() {
    this._reload.next();
  }

  skipCurrent() {
    const all = this._suggestions.getValue();
    this._suggestions.next(all.slice(1));
  }

  applyCurrent(primaryRef?: CustomerRef) {
    if (!this.first) {
      return;
    }
    let sug = this.first;
    if (!!primaryRef) {
      sug.data.primary = primaryRef;
    }
    this.customerapi.applySuggestion(sug)
      .subscribe(() => this.skipCurrent())
  }

  discardCurrent(del = false) {
    if (!this.first) {
      return;
    }
    this.customerapi.deleteSuggestion(this.first.id, del)
      .subscribe(() => this.skipCurrent())
  }
}

