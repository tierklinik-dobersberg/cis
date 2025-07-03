import { computed, signal, Signal } from '@angular/core';
import { PaginatorState } from '@spartan-ng/ui-table-brain';

export interface IPaginationManager {
  currentPage: Signal<number>;
  totalPages: Signal<number>;
  pageSize: Signal<number>;
  totalElements: Signal<number>;
  pageButtons: Signal<number[]>;
  availablePageSizes: number[];

  onStateChange: (state: PaginatorState) => void;

  openPage(idx: number);

}

export function usePaginationManager<T = any>(recordSignal: Signal<T[]>): PaginationManager<T> {
    return new PaginationManager(recordSignal);
}

export class PaginationManager<T = any> implements IPaginationManager {
  private readonly _range = signal({ from: 0, to: 20 });
  private readonly _currentPage = signal(0);
  private readonly _totalPages = signal(1);

  public readonly currentPage = this._currentPage.asReadonly();
  public readonly totalPages = this._totalPages.asReadonly();
  public readonly pageSize = signal(this.availablePageSizes[1]);
  public readonly totalElements = computed(() => this.records().length);

  constructor(
    public readonly records: Signal<T[]>,
    public readonly availablePageSizes = [10, 20, 50, 100],
  ) {}

  public readonly onStateChange = (state: PaginatorState) => {
    this._range.set({ from: state.startIndex, to: state.endIndex });
    this._currentPage.set(state.currentPage);
    this._totalPages.set(state.totalPages);
  }

  public readonly data = computed(() => {
    const data = this.records();
    const page = this._range();

    return data.slice(page.from, page.to+1);
  });

  public openPage(idx: number) {
    if (idx > this.totalPages()) {
        idx = this.totalPages();
    }

    if (idx < 0) {
        idx = 0
    }

    this._currentPage.set(idx);
  }

  /** A list of page indices to display in the paginator */
  public readonly pageButtons = computed(() => {
    const current = this.currentPage();
    const total = this.totalPages();

    const pages: number[] = [];

    const start = current === total ? -2 : -1;
    const end = current === 0 ? 2 : 1;

    for (let i = start; i <= end; i++) {
      const idx = current + i;
      if (idx >= 0 && idx <= total) {
        pages.push(idx);
      }
    }

    if (pages[0] !== 0) {
      pages.splice(0, 0, 0);
    }

    if (pages[pages.length - 1] !== total && total > 0) {
      pages.push(total);
    }

    return pages;
  });
}

export class AsyncPaginationManager<T> extends PaginationManager<T> {
  public readonly data = computed(() => this.records())

  private readonly _totalElements = signal(0);

  public readonly totalElements = this._totalElements.asReadonly();

  public setTotalCount(count: number) {
    this._totalElements.set(count);
  }
}