import { ApplicationRef, Injectable, inject } from "@angular/core";
import { SwUpdate } from "@angular/service-worker";
import { toast } from 'ngx-sonner';
import { concat, first, interval, startWith } from "rxjs";

@Injectable({ providedIn: 'root'})
export class SwUpdateManager {
  private readonly updates = inject(SwUpdate);
  private readonly appRef = inject(ApplicationRef);

  init() {
    if (this.updates.isEnabled) {
      // version updates
      this.updates.versionUpdates.subscribe(evt => {
        switch (evt.type) {
          case 'VERSION_READY':
            const ref = toast.info('Neue Version verfügbar', {
              description: 'Eine neue Version von CIS wurde installiert. Bitte lade die Applikation neu um auf die neue Version zu wechseln',
              action: {
                label: 'Jetzt Verwenden!',
                onClick: () => window.location.reload()
              },
              cancel: {
                label: 'Später',
                onClick: () => toast.dismiss(ref)
              },
              duration: 0,
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
