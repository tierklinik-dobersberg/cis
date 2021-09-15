import { NullTemplateVisitor } from "@angular/compiler";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { NzModalRef } from "ng-zorro-antd/modal";
import { forkJoin, of, Subject } from "rxjs";
import { catchError, map, mergeMap } from "rxjs/operators";
import { CallLog, CalllogAPI } from "src/app/api";
import { Customer, CustomerAPI, Suggestion } from "src/app/api/customer.api";
import { customerTagColor } from "../../customer/utils";

interface LocalSuggestion extends Suggestion {
  customers: LocalCustomer[];
}

interface LocalCustomer extends Customer {
  lastCall: CallLog | null;
}

@Component({
  selector: 'app-suggestion-card',
  templateUrl: './suggestion-card.html',
  styleUrls: ['./suggestion-card.scss'],
})
export class SuggestionCardComponent implements OnInit, OnDestroy {
  private _destroy$ = new Subject();

  customerTagColor = customerTagColor;

  _suggestions: Suggestion[] = [];

  nextSuggestion: LocalSuggestion | null = null;

  constructor(
    private customerAPI: CustomerAPI,
    private calllogAPI: CalllogAPI,
    private nzModalRef: NzModalRef,
  ) { }

  ngOnInit() {
    this.customerAPI.getSuggestions({ limit: 100 })
      .subscribe(res => {
        this._suggestions = res;

        this.nextSuggestion = null;
        if (!!res && res.length > 0) {
          this.loadNext(res[0]);
          this._suggestions = res.slice(1);
        }
      })
  }

  private loadNext(s: Suggestion) {
    forkJoin(
      s.data.refs.map(r => this.customerAPI.byId(r)
        .pipe(
          mergeMap(cus => {
            return this.calllogAPI.forCustomer(r)
              .pipe(
                catchError(err => of([])),
                map(calls => {
                  return {
                    ...cus,
                    lastCall: calls[0] || null
                  }
                })
              )
          })
        ))
    )
      .subscribe(customers => {
        this.nextSuggestion = {
          ...s,
          customers: customers,
        }
      })
  }

  close(event: MouseEvent) {
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();

    this.nzModalRef.close();
  }

  ngOnDestroy() {
    this._destroy$.next();
    this._destroy$.complete();
  }

  dontAskAgain() {
    this.customerAPI.deleteSuggestion(this.nextSuggestion.id)
      .subscribe(() => this.skip())
  }

  skip() {
    if (!!this._suggestions[0]) {
      this.loadNext(this._suggestions[0]);
    } else {
      this.nextSuggestion = null;
    }
    this._suggestions = this._suggestions.slice(1);
  }

  apply() {
    this.customerAPI.applySuggestion(this.nextSuggestion)
      .subscribe(() => this.skip())
  }
}
