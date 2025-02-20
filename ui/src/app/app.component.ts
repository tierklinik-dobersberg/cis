import { animate, style, transition, trigger } from '@angular/animations';
import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  effect,
  inject,
  signal
} from '@angular/core';
import { Code, ConnectError } from '@connectrpc/connect';
import { injectCurrentProfile } from '@tierklinik-dobersberg/angular/behaviors';
import { LayoutService } from '@tierklinik-dobersberg/angular/layout';
import { MarkdownService } from 'ngx-markdown';
import { toast } from 'ngx-sonner';
import {
  retry,
  tap
} from 'rxjs/operators';
import { SwUpdateManager, WebPushSubscriptionManager } from 'src/app/services';
import { environment } from 'src/environments/environment';
import { StudyService } from './components/dicom/study.service';
import { NavigationService } from './layout/navigation/navigation.service';

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
        animate('150ms ease-in-out', style({
          transform: 'translateX(0%)',
          opacity: 1
        }))
      ]),
      transition('* => void', [
        animate('150ms ease-in-out', style({
          transform: 'translateX(-100%)',
          opacity: 0,
        }))
      ]),
    ])
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  private readonly webPushManager = inject(WebPushSubscriptionManager);
  private readonly updateManager = inject(SwUpdateManager);
  private readonly markdownService = inject(MarkdownService);
  private readonly studyService = inject(StudyService);

  protected readonly navService = inject(NavigationService);
  protected readonly layout = inject(LayoutService);

  protected readonly isReachable = signal(false);
  protected readonly checkRunning = signal(false);

  private readonly http = inject(HttpClient);
  private readonly currentUser = injectCurrentProfile();

  constructor() {
    this.studyService
      .instanceReceived
      .subscribe(msg => {
        toast.info(
          "Neue Röntgenaufnahme",

          {
            description: `${msg.ownerName}, ${msg.patientName}`,
            duration: 20*1000,
            action: {
              label: 'ÖFFNEN',
              onClick: () => {
                window.open(`${environment.orthancBridge}/viewer?StudyInstanceUIDs=${msg.studyUid}`, '_blank')
              }
            }
          }
        )
      })

    let ref = effect(() => {
      const profile = this.currentUser();

      if (profile) {
        setTimeout(() => this.webPushManager.updateWebPushSubscription(), 1000)
        ref.destroy();
      }
    })
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
              window.location.replace(`${environment.accountService}/login?redirect=${redirectTarget}&force=true`);
            }
          }
        }),
        retry({ delay: 2000 })
      )
      .subscribe({
        next: () => {
          this.isReachable.set(true)
          this.checkRunning.set(false);
        },
        error: (err) => console.error(err),
      });
  }
}
