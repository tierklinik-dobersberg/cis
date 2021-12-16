import { Component, OnDestroy, OnInit, TrackByFunction } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { Observable, Subscription } from 'rxjs';
import { parse as parseQuery } from 'search-query-parser';
import { Customer, CustomerAPI } from 'src/app/api/customer.api';
import { HeaderTitleService } from 'src/app/shared/header-title';
import { extractErrorMessage, toMongoDBFilter } from 'src/app/utils';
import { customerTagColor, ExtendedCustomer } from './utils';

@Component({
  templateUrl: './customer-list.html',
  styleUrls: ['./customer-list.scss']
})
export class CustomerListComponent implements OnInit, OnDestroy {
  private subscriptions = Subscription.EMPTY;

  searchText = '';
  customers: ExtendedCustomer[] = [];
  allCustomers: ExtendedCustomer[] = [];
  useAdvancedSearch = false;
  searching = false;
  sourceTags = new Set<string>();
  tagColors: { [key: string]: string } = {};

  visibleTag: 'all' | string = 'all';

  trackBy: TrackByFunction<Customer> = (_: number, cust: Customer) => cust.cid;

  constructor(
    private header: HeaderTitleService,
    private customerapi: CustomerAPI,
    private nzMessageService: NzMessageService,
  ) { }

  ngOnInit(): void {
    this.header.set('Kunden', 'Stammdaten durchsuchen und verwalten');
    this.subscriptions = new Subscription();

    this.search('');
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  search(term: string): void {
    let stream: Observable<Customer[]> = this.customerapi.searchName(term);

    if (this.useAdvancedSearch) {
      let payload: any;
      try {
        payload = JSON.parse(term);
      } catch (err) {
        return;
      }

      stream = this.customerapi.extendedSearch(payload);
    } else {
      const parsedQuery = parseQuery(term, {
        keywords: ['name', 'firstname', 'phoneNumbers', 'city', 'cityCode', 'street', 'mailAddresses', 'customerSource']
      });

      if (typeof parsedQuery !== 'string') {
        const filter = toMongoDBFilter(parsedQuery);
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
          const tagColor = customerTagColor(c);
          this.allCustomers.push({
            ...c,
            tagColor,
          });

          this.sourceTags.add(c.source);
          this.tagColors[c.source] = tagColor;
        });

        this.updateTagVisibility();
      },
      err => {
        const msg = extractErrorMessage(err, 'Suche fehlgeschlagen');
        this.nzMessageService.error(msg);

        this.customers = [];
        this.sourceTags = new Set();
      },
      () => {
        this.searching = false;
      });
  }

  updateTagVisibility(): void {
    this.customers = this.allCustomers.filter(c => this.visibleTag === 'all' || this.visibleTag === c.source);
  }
}
