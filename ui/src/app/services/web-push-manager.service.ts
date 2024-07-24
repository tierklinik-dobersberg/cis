import { Injectable, inject } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { injectNotifyService } from '@tierklinik-dobersberg/angular/connect';
import { NzModalService } from 'ng-zorro-antd/modal';
import { distinctUntilChanged } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class WebPushSubscriptionManager {
  private notifyService = injectNotifyService();
  private swPush = inject(SwPush);
  private modal = inject(NzModalService);

  private setupWebPush() {
    this.notifyService
      .getVAPIDPublicKey({})
      .then(res => {
        return res.key;
      })
      .then(key => {
        return this.swPush.requestSubscription({
          serverPublicKey: key,
        });
      })
      .catch(err => {
        console.error(err);
      });
  }

  public updateWebPushSubscription() {
    // make sure we update our web-push subscription
    if (this.swPush.isEnabled) {
      this.swPush.subscription
        .pipe(
          distinctUntilChanged(
            (prev, curr) => prev?.endpoint === curr?.endpoint
          )
        )
        .subscribe({
          next: sub => {
            if (sub === null) {
              try {
                if (localStorage.getItem('cis:asked_for_webpush')) {
                  return;
                }
                localStorage.setItem('cis:asked_for_webpush', 'true');
              } catch (err) {
                console.error(err);

                // Do not ask if there was an error
                return;
              }

              this.modal.confirm({
                nzTitle: 'Benachrichtigungen aktivieren',
                nzContent:
                  'CIS kann Benachrichtigungen an dein Gerät senden um dich über Änderungen am Dienstplan oder Urlaubsanträge zu informieren. Möchtest du diese Benachrichtigungen aktivieren?',
                nzOkText: 'Aktivieren',
                nzCancelText: 'Nein danke',
                nzOnOk: () => {
                  this.setupWebPush();
                },
              });
            } else {
              this.notifyService.addWebPushSubscription({
                subscription: {
                  endpoint: sub!.endpoint,
                  keys: {
                    p256dh: btoa(
                      String.fromCharCode(
                        ...new Uint8Array(sub!.getKey('p256dh')!)
                      )
                    ),
                    auth: btoa(
                      String.fromCharCode(
                        ...new Uint8Array(sub!.getKey('auth')!)
                      )
                    ),
                  },
                },
              });
            }
          },
          complete: () => {},
        });
    }
  }
}
