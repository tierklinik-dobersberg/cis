import { Component, OnDestroy, OnInit } from "@angular/core";
import { NzMessageService } from "ng-zorro-antd/message";
import { NzModalRef } from "ng-zorro-antd/modal";
import { forkJoin, of, Subject } from "rxjs";
import { catchError, map, mergeMap, take } from "rxjs/operators";
import { CallLog, CalllogAPI } from "src/app/api";
import { Customer, CustomerAPI, CustomerRef, Suggestion } from "src/app/api/customer.api";
import { extractErrorMessage } from "src/app/utils";
import { customerTagColor } from "../../customer/utils";
import { SuggestionService } from "../suggestion.service";

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
  primaryRef: CustomerRef | null = null;
  loaded = false;

  sourceCounts: { [key: string]: number } = {};

  constructor(
    private customerAPI: CustomerAPI,
    private calllogAPI: CalllogAPI,
    private nzModalRef: NzModalRef,
    private nzMessageService: NzMessageService,
    private suggestionService: SuggestionService,
  ) { }

  ngOnInit() {
    this.nzModalRef.afterClose
      .pipe(take(1))
      .subscribe(() => this.suggestionService.reload());

    this.suggestionService.first$
      .subscribe(sug => this.loadNext(sug));
  }

  private loadNext(s: Suggestion | null) {
    this.sourceCounts = {};
    this.loaded = true;
    if (!s) {
      this.nextSuggestion = null;
      return;
    }
    this.primaryRef = s.data.primary || null;
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
        customers.forEach(cus => {
          this.sourceCounts[cus.source] = (this.sourceCounts[cus.source] || 0) + 1;
        })
      }, err => {
        // there was an error loading the customers of this
        // suggestion so skip over to the next one.
        this.skip();
      })
  }

  get primarySource() {
    return this.primaryRef?.source;
  }

  get primaryCid() {
    return this.primaryRef?.cid;
  }

  deleteCustomer(customer: Customer) {
    const loading = this.nzMessageService.loading("Kunde wird gelöscht ...");
    this.customerAPI.deleteCustomer(customer)
      .subscribe({
        next: () => {
          this.nzMessageService.remove(loading.messageId);
          this.suggestionService.discardCurrent(true);
        },
        error: err => {
          this.nzMessageService.remove(loading.messageId);
          this.nzMessageService.error(extractErrorMessage(err, 'Kunde konnte nicht gelöscht werden'))
        }
      })
  }

  setPrimary(ref: CustomerRef) {
    this.primaryRef = ref;
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
    this.suggestionService.discardCurrent();
  }

  skip() {
    this.suggestionService.skipCurrent();
  }

  apply() {
    this.suggestionService.applyCurrent(this.primaryRef);
  }
}
