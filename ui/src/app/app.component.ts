import { animate, style, transition, trigger } from '@angular/animations';
import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Code, ConnectError } from '@connectrpc/connect';
import { injectCustomerService } from '@tierklinik-dobersberg/angular/connect';
import { HlmDialogService } from '@tierklinik-dobersberg/angular/dialog';
import { LayoutService } from '@tierklinik-dobersberg/angular/layout';
import { CallRecordReceived } from '@tierklinik-dobersberg/apis/pbx3cx/v1';
import { ExternalToast, toast } from 'ngx-sonner';
import { retry, tap } from 'rxjs/operators';
import { SwUpdateManager, WebPushSubscriptionManager } from 'src/app/services';
import { environment } from 'src/environments/environment';
import { StudyService } from './components/dicom/study.service';
import { CreateEventSheetComponent } from './features/calendar2/create-event-sheet/create-event-sheet.component';
import { SearchEventsDialogComponent } from './features/calendar2/search-events-dialog/search-events-dialog.component';
import { CustomerSearchDialogComponent } from './features/customers/customer-search-dialog';
import { NavigationService } from './layout/navigation/navigation.service';
import { EventService } from './services/event.service';
import { injectStoredProfile } from './utils/inject-helpers';

interface MenuEntry {
  Icon: string;
  Link: string;
  Text: string;
  BlankTarget: boolean;
}

interface SubMenu {
  Text: string;
  Items: MenuEntry[];
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  animations: [
    trigger('moveInOut', [
      transition('void => *', [
        style({
          transform: 'translateX(-100%)',
          opacity: 0,
          position: 'absolute',
        }),
        animate(
          '150ms ease-in-out',
          style({
            transform: 'translateX(0%)',
            opacity: 1,
          })
        ),
      ]),
      transition('* => void', [
        animate(
          '150ms ease-in-out',
          style({
            transform: 'translateX(-100%)',
            opacity: 0,
          })
        ),
      ]),
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  private readonly webPushManager = inject(WebPushSubscriptionManager);
  private readonly updateManager = inject(SwUpdateManager);
  private readonly eventsService = inject(EventService);
  private readonly studyService = inject(StudyService);
  private readonly customerService = injectCustomerService();
  private readonly dialogService = inject(HlmDialogService);

  protected readonly navService = inject(NavigationService);
  protected readonly layout = inject(LayoutService);

  protected readonly isReachable = signal(false);
  protected readonly checkRunning = signal(false);

  private readonly http = inject(HttpClient);
  private readonly currentUser = injectStoredProfile();

  constructor() {
    this.studyService.instanceReceived.subscribe(msg => {
      toast.info(
        'Neue Röntgenaufnahme',

        {
          description: `${msg.ownerName}, ${msg.patientName}`,
          duration: 20 * 1000,
          action: {
            label: 'ÖFFNEN',
            onClick: () => {
              window.open(
                `${environment.orthancBridge}/viewer?StudyInstanceUIDs=${msg.studyUid}`,
                '_blank'
              );
            },
          },
        }
      );
    });

    let ref = effect(() => {
      const profile = this.currentUser();

      if (profile) {
        setTimeout(() => this.webPushManager.updateWebPushSubscription(), 1000);
        ref.destroy();
      }
    });

    const toasts = new Map<string, any>();

    this.eventsService.subscribe(new CallRecordReceived()).subscribe(evt => {
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

        let action: undefined | ExternalToast['action'] = {
          label: 'Neuer Termin',
          onClick: () => {
            CreateEventSheetComponent.open(this.dialogService, {
              customerId: evt.callEntry?.customerId || caller,
              isUnknown: !evt.callEntry?.customerId
            });
          },
        };

        display.then(who => {
          const id = toast.loading('Aktives Telefonat mit ' + who, {
            duration: 10 * 60 * 1000,
            actionButtonStyle: 'font-medium',
            action,
          });

          console.log('adding caller id', caller, id, evt);
          toasts.set(caller, id);
        });
      } else {
        // call finished
        const id = toasts.get(caller);
        if (id !== undefined) {
          toast.dismiss(id);
          toasts.delete(id);
        } else {
          console.log(
            'no active toast for caller',
            caller,
            Array.from(toasts.keys())
          );
        }
      }
    });
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    console.log('event');
    if (event.key === 'c' && event.altKey) {
      if (CustomerSearchDialogComponent.lastRef) {
        CustomerSearchDialogComponent.lastRef.close();
      } else {
        CustomerSearchDialogComponent.open(this.dialogService);
      }
    }

    if (event.key === 't' && event.altKey) {
      if (SearchEventsDialogComponent.lastRef) {
        SearchEventsDialogComponent.lastRef.close();
      } else {
        SearchEventsDialogComponent.open(this.dialogService);
      }
    }

    if (event.key === 'n' && event.altKey) {
      CreateEventSheetComponent.open(this.dialogService)
    }
  }

  ngOnInit(): void {
    this.updateManager.init();

    this.checkReachability();
  }

  @HostListener('window:focus')
  checkReachability() {
    if (this.checkRunning()) {
      return;
    }
    this.checkRunning.set(true);

    this.http
      .get('/api/')
      .pipe(
        tap({
          error: err => {
            this.isReachable.set(false);

            if (ConnectError.from(err).code === Code.Unauthenticated) {
              const redirectTarget = btoa(`${location.href}`);
              window.location.replace(
                `${environment.accountService}/login?redirect=${redirectTarget}&force=true`
              );
            }
          },
        }),
        retry({ delay: 2000 })
      )
      .subscribe({
        next: () => {
          this.isReachable.set(true);
          this.checkRunning.set(false);
        },
        error: err => console.error(err),
      });
  }
}
