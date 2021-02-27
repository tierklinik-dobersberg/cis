import { Component, OnDestroy, OnInit, TrackByFunction } from "@angular/core";
import { NzMessageService } from "ng-zorro-antd/message";
import { from, Observable, Subject, Subscription } from "rxjs";
import { Customer, CustomerAPI } from "src/app/api/customer.api";
import { extractErrorMessage, toMongoDBFilter } from "src/app/utils";
import { parse as parseQuery } from 'search-query-parser';
import { ExtendedCustomer, customerTagColor } from './utils';
import { HeaderTitleService } from "src/app/shared/header-title";

@Component({
  templateUrl: './customer-list.html',
  styleUrls: ['./customer-list.scss']
})
export class CustomerListComponent implements OnInit, OnDestroy {
  private subscriptions = Subscription.EMPTY;

  searchText = ''
  customers: ExtendedCustomer[] = [];
  allCustomers: ExtendedCustomer[] = [];
  useAdvancedSearch: boolean = false;
  searching = false;
  sourceTags = new Set<string>();
  tagColors: { [key: string]: string } = {};
  tagVisibility: { [key: string]: boolean } = {};

  trackBy: TrackByFunction<Customer> = (_: number, cust: Customer) => cust.cid;

  constructor(
    private header: HeaderTitleService,
    private customerapi: CustomerAPI,
    private nzMessageService: NzMessageService,
  ) { }

  ngOnInit() {
    this.header.set('Kunden');
    this.subscriptions = new Subscription();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  search(term: string) {
    let stream: Observable<Customer[]> = this.customerapi.searchName(term);

    if (this.useAdvancedSearch) {
      let payload: any;
      try {
        payload = JSON.parse(term)
      } catch (err) {
        return
      }

      stream = this.customerapi.extendedSearch(payload)
    } else {
      let parsedQuery = parseQuery(term, {
        keywords: ['name', 'firstname', 'phoneNumbers', 'city', 'cityCode', 'street', 'mailAddresses', 'customerSource']
      })

      if (typeof parsedQuery !== 'string') {
        let filter = toMongoDBFilter(parsedQuery)
        stream = this.customerapi.extendedSearch(filter);
      }
    }

    this.searching = true;
    stream.subscribe(
      result => {
        this.sourceTags = new Set();
        this.tagColors = {};
        this.allCustomers = [];

        (result || []).forEach(c => {
          let tagColor = customerTagColor(c);
          this.allCustomers.push({
            ...c,
            tagColor: tagColor,
          })

          this.sourceTags.add(c.source);
          this.tagColors[c.source] = tagColor;
          if (this.tagVisibility[c.source] === undefined) {
            this.tagVisibility[c.source] = true;
          }
        });

        this.customers = this.allCustomers.filter(c => !!this.tagVisibility[c.source])
      },
      err => {
        const msg = extractErrorMessage(err, "Suche fehlgeschlagen")
        this.nzMessageService.error(msg);

        this.customers = [];
        this.sourceTags = new Set();
      },
      () => {
        this.searching = false;
      })
  }

  updateTagVisibility(tag: string, visible: boolean) {
    this.tagVisibility[tag] = visible;
    this.customers = this.allCustomers.filter(c => !!this.tagVisibility[c.source])
  }
}
