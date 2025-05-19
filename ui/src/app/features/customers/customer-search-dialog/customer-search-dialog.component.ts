import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  model,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { PartialMessage } from '@bufbuild/protobuf';
import { ConnectError } from '@connectrpc/connect';
import { lucideMapPin, lucideUserRoundSearch } from '@ng-icons/lucide';
import { hlm } from '@spartan-ng/ui-core';
import { BrnDialogRef } from '@spartan-ng/ui-dialog-brain';
import { BrnTableModule } from '@spartan-ng/ui-table-brain';
import { BrnTooltipModule } from '@spartan-ng/ui-tooltip-brain';
import { HlmBadgeDirective } from '@tierklinik-dobersberg/angular/badge';
import { HlmButtonDirective } from '@tierklinik-dobersberg/angular/button';
import { HlmCardModule } from '@tierklinik-dobersberg/angular/card';
import { injectCustomerService } from '@tierklinik-dobersberg/angular/connect';
import { HlmDialogModule, HlmDialogService } from '@tierklinik-dobersberg/angular/dialog';
import {
  HlmIconModule,
  provideIcons,
} from '@tierklinik-dobersberg/angular/icon';
import { HlmInputDirective } from '@tierklinik-dobersberg/angular/input';
import { LayoutService } from '@tierklinik-dobersberg/angular/layout';
import { HlmTableModule } from '@tierklinik-dobersberg/angular/table';
import { HlmTooltipModule } from '@tierklinik-dobersberg/angular/tooltip';
import {
  CustomerQuery,
  CustomerResponse,
  SearchCustomerResponse,
} from '@tierklinik-dobersberg/apis/customer/v1';
import { toast } from 'ngx-sonner';
import { filter, take } from 'rxjs';
import { TkdPaginationComponent } from 'src/app/components/pagination';
import { DIALOG_CONTENT_CLASS } from 'src/app/dialogs/constants';
import { AsyncPaginationManager } from 'src/app/utils/pagination-manager';

@Component({
  standalone: true,
  templateUrl: './customer-search-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HlmIconModule,
    HlmButtonDirective,
    HlmTooltipModule,
    HlmBadgeDirective,
    HlmTableModule,
    BrnTableModule,
    TkdPaginationComponent,
    HlmCardModule,
    HlmInputDirective,
    BrnTooltipModule,
    RouterLink,
    HlmDialogModule,
    FormsModule,
    HlmBadgeDirective
  ],
  providers: [
    ...provideIcons({
      lucideMapPin,
      lucideUserRoundSearch,
    }),
  ],
  host: {
    'class': 'overflow-y-hidden h-full flex flex-col gap-4'
  }
})
export class CustomerSearchDialogComponent {
  public static lastRef: BrnDialogRef | null = null;

  static open(service: HlmDialogService): BrnDialogRef<unknown> {
    if (this.lastRef) {
      return
    }

    return (this.lastRef = service.open(CustomerSearchDialogComponent, {
      contentClass: hlm(DIALOG_CONTENT_CLASS, "md:max-h-[90vh] md:h-[90vh] overflow-hidden"),
    }));
  }

  private readonly customerSerivce = injectCustomerService();

  private readonly router = inject(Router)
  private readonly dialogRef = inject(BrnDialogRef)

  protected readonly searchByName = model('');
  protected readonly loading = signal(false);
  protected readonly layout = inject(LayoutService)
  protected readonly customers = signal<CustomerResponse[]>([]);

  protected readonly paginator = new AsyncPaginationManager(this.customers);

  private _lastCustomerResponse: SearchCustomerResponse | null = null;
  constructor() {
    this.dialogRef
      .closed$
      .pipe(take(1))
      .subscribe(() => CustomerSearchDialogComponent.lastRef = null)

    this.router
      .events
      .pipe(
        takeUntilDestroyed(),
        filter(evt => evt instanceof NavigationEnd && evt.url.includes("customers/"))
      )
      .subscribe(() => this.dialogRef.close())

    effect(
      () => {
        const page = this.paginator.currentPage();
        const pageSize = this.paginator.pageSize();

        const search = this.searchByName();

        this.loading.set(true);

        let queries: PartialMessage<CustomerQuery>[] | null = null;
        const parts = search.split(' ');

        if (search != '') {
          if (search[0] === '+' || !isNaN(+search[0])) {
            queries = [
                {
                    query: {
                        case: 'phoneNumber',
                        value: search
                    }
                }
            ];
          } else if (search.includes('@')) {
            queries = [
                {
                    query: {
                        case: 'emailAddress',
                        value: search
                    }
                }
            ];
          } else {
            queries = [
              {
                query: {
                  case: 'name',
                  value: {
                    lastName: parts[0],
                    firstName: parts.length > 1 ? parts[1] : undefined,
                  },
                },
              },
              {
                query: {
                  case: 'name',
                  value: {
                    firstName: parts[0],
                    lastName: parts.length > 1 ? parts[1] : undefined,
                  },
                },
              },
            ];
          }
        }

        this.customerSerivce
          .searchCustomer({
            queries,
            pagination: {
              kind: {
                case: 'page',
                value: page,
              },
              pageSize: pageSize,
            },
          })
          .catch(err => {
            toast.error('Kunden konnten nicht geladen werden', {
              description: ConnectError.from(err).message,
            });

            return new SearchCustomerResponse();
          })
          .then(response => {
            if (response.equals(this._lastCustomerResponse)) {
              return;
            }

            this._lastCustomerResponse = response;
            this.customers.set(response.results);
            this.paginator.setTotalCount(Number(response.totalResults));
          });
      },
      { allowSignalWrites: true }
    );
  }
}
