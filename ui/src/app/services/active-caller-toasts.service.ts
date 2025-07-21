import { inject, Injectable } from '@angular/core';
import { injectCustomerService } from '@tierklinik-dobersberg/angular/connect';
import { HlmDialogService } from '@tierklinik-dobersberg/angular/dialog';
import { HlmIconComponent } from '@tierklinik-dobersberg/angular/icon';
import { CallRecordReceived } from '@tierklinik-dobersberg/apis/pbx3cx/v1';
import { ExternalToast, toast } from 'ngx-sonner';
import { CreateEventSheetComponent } from '../features/calendar2/create-event-sheet/create-event-sheet.component';
import { EventService } from './event.service';

@Injectable({
  providedIn: 'root',
})
export class ActiveCallerToastService {
  private readonly eventsService = inject(EventService);
  private readonly customerService = injectCustomerService();
  private readonly dialogService = inject(HlmDialogService)

  constructor() {
    const activeCallerToastMap = new Map<string, any>();

    this.eventsService.subscribe(new CallRecordReceived())
      .subscribe(evt => {
      const caller = evt.callEntry.caller;

      if (Number(evt.callEntry?.duration?.seconds || 0) === 0) {
        // new active call received

        let display = Promise.resolve(caller);

        if (evt.callEntry.customerId) {
          display = this.customerService
            .searchCustomer({
              queries: [
                {
                  query: {
                    case: 'id',
                    value: evt.callEntry.customerId,
                  },
                },
              ],
            })
            .then(response => {
              if (response.results && response.results.length === 1) {
                const customer = response.results[0].customer;
                if (customer) {
                  return `${customer.lastName} ${customer.firstName}`;
                }
              }

              return '';
            })
            .catch(err => {
              console.error(err);

              return caller;
            });
        }

        const action: undefined | ExternalToast['action'] = {
          label: 'Neuer Termin',
          onClick: () => {
            CreateEventSheetComponent.open(this.dialogService, {
              customerId: evt.callEntry?.customerId || caller,
              isUnknown: !evt.callEntry?.customerId,
            });
          },
        };

        display.then(who => {
          const id = toast.info('Telefonat mit ' + who, {
            duration: Number.POSITIVE_INFINITY,
            dismissable: true,
            actionButtonStyle: 'font-medium',
            action,
            icon: HlmIconComponent,
          });

          activeCallerToastMap.set(caller, id);
        });
      } else {
        // call finished
        const id = activeCallerToastMap.get(caller);
        if (id !== undefined) {
          toast.dismiss(id);
          activeCallerToastMap.delete(id);
        }
      }
    });
  }
}
