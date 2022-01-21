import { Component, OnDestroy, OnInit, TemplateRef, TrackByFunction, ViewChild } from '@angular/core';
import { MatBottomSheet, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { NzMessageService } from 'ng-zorro-antd/message';
import { Observable, Subscription } from 'rxjs';
import { parse as parseQuery } from 'search-query-parser';
import { Customer, CustomerAPI } from 'src/app/api/customer.api';
import { HeaderTitleService } from 'src/app/shared/header-title';
import { extractErrorMessage, toMongoDBFilter } from 'src/app/utils';
import { customerTagColor, ExtendedCustomer, getMapsRouteUrl } from './utils';

@Component({
  templateUrl: './customer-list.html',
  styleUrls: ['./customer-list.scss']
})
export class CustomerListComponent implements OnInit, OnDestroy {
  private subscriptions = Subscription.EMPTY;

  @ViewChild('customerSelectPhone', {static: true, read: TemplateRef})
  customerSelectPhone: TemplateRef<any> | null = null;

  searchText = '';
  customers: ExtendedCustomer[] = [];
  allCustomers: ExtendedCustomer[] = [];
  useAdvancedSearch = false;
  searching = false;
  sourceTags = new Set<string>();
  tagColors: { [key: string]: string } = {};

  visibleTag: 'all' | string = 'all';

  bottomSheetRef: MatBottomSheetRef | null = null;

  trackBy: TrackByFunction<ExtendedCustomer> = (_: number, cust: ExtendedCustomer) => cust.cid;

  constructor(
    private header: HeaderTitleService,
    private customerapi: CustomerAPI,
    private nzMessageService: NzMessageService,
    private bottomSheet: MatBottomSheet,
  ) { }

  ngOnInit(): void {
    this.header.set('Kunden', 'Stammdaten durchsuchen und verwalten');
    this.subscriptions = new Subscription();

    this.search('');
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  callCustomer(cus: ExtendedCustomer) {
    if (cus.distinctPhoneNumbers.length === 1) {
      window.open(`tel:` + cus.distinctPhoneNumbers[0])
      return;
    }

    this.bottomSheetRef = this.bottomSheet.open(this.customerSelectPhone!, {
      data: cus,
    })
    this.bottomSheetRef.afterDismissed()
      .subscribe(() => this.bottomSheetRef = null);
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
          const mapsUrl = getMapsRouteUrl(c);
          this.allCustomers.push({
            ...c,
            tagColor,
            mapsUrl,
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
