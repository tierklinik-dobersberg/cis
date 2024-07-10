import { ApplicationRef, Injectable, inject } from "@angular/core";
import { SwUpdate } from "@angular/service-worker";
import { NzModalService } from "ng-zorro-antd/modal";
import { toast } from 'ngx-sonner'
import { first, interval, startWith, concat } from "rxjs";

@Injectable({ providedIn: 'root'})
export class SwUpdateManager {
  private readonly updates = inject(SwUpdate);
  private readonly modal = inject(NzModalService);
  private readonly appRef = inject(ApplicationRef);

  init() {
    if (this.updates.isEnabled) {
      // version updates
      this.updates.versionUpdates.subscribe(evt => {
        switch (evt.type) {
          case 'VERSION_READY':
            this.modal
              .confirm({
                nzTitle: 'Neue Version verfügbar',
                nzContent: 'Eine neue Version von CIS wurde installiert. Bitte lade die Applikation neu um auf die neue Version zu wechseln',
                nzOkText: 'Jetzt verwenden',
                nzOnOk: () => {
                  window.location.reload();
                },
                nzCancelText: 'Später'
              })

            break;

          case 'VERSION_INSTALLATION_FAILED':
            toast.error(`Failed to install app version '${evt.version.hash}': ${evt.error}`);
            break;
        }
      });

      // Allow the app to stabilize first, before starting
      // polling for updates with `interval()`.
      const appIsStable$ = this.appRef.isStable.pipe(first(isStable => isStable === true));
      const everySixHours$ = interval(60 * 60 * 1000)
        .pipe(startWith(-1));

      const everyHourOnceAppIsStable$ = concat(appIsStable$, everySixHours$);

      everyHourOnceAppIsStable$.subscribe(async () => {
        try {
          const updateFound = await this.updates.checkForUpdate();
          console.log(updateFound ? 'A new version is available.' : 'Already on the latest version.');
        } catch (err) {
          console.error('Failed to check for updates:', err);
        }
      });

      this.updates.unrecoverable.subscribe(event => {
        toast.error(
          'An error occurred that we cannot recover from:' +
          event.reason +
          ' Please reload the page.'
        );
      });
    }
  }
}
