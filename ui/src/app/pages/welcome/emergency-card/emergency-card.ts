import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ConnectError } from '@connectrpc/connect';
import { lucidePhone, lucidePhoneCall } from '@ng-icons/lucide';
import { BrnSeparatorComponent } from '@spartan-ng/ui-separator-brain';
import { HlmAlertModule } from '@tierklinik-dobersberg/angular/alert';
import { injectUserProfiles } from '@tierklinik-dobersberg/angular/behaviors';
import { HlmButtonDirective } from '@tierklinik-dobersberg/angular/button';
import { HlmCardDirective, HlmCardModule } from '@tierklinik-dobersberg/angular/card';
import {
  HlmIconModule,
  provideIcons,
} from '@tierklinik-dobersberg/angular/icon';
import { HlmLabelDirective } from '@tierklinik-dobersberg/angular/label';
import { LayoutService } from '@tierklinik-dobersberg/angular/layout';
import {
  DisplayNamePipe,
  ToDatePipe,
  ToUserPipe,
} from '@tierklinik-dobersberg/angular/pipes';
import { HlmSeparatorDirective } from '@tierklinik-dobersberg/angular/separator';
import { HlmSkeletonComponent } from '@tierklinik-dobersberg/angular/skeleton';
import { GetOnCallResponse, InboundNumber, ListInboundNumberResponse } from '@tierklinik-dobersberg/apis/pbx3cx/v1';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { toast } from 'ngx-sonner';
import { CALL_SERVICE } from 'src/app/api/connect_clients';
import { AppAvatarComponent, AvatarVariants } from 'src/app/components/avatar';
import { EmergencyTargetService } from 'src/app/layout/redirect-emergency-button/emergency-target.service';

class OnCallResponse extends GetOnCallResponse {
  constructor(
    res: GetOnCallResponse,
    public readonly number?: InboundNumber
  ) {
    super(res);
  }
}

@Component({
  selector: 'app-emergency-card',
  templateUrl: './emergency-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    HlmIconModule,
    HlmCardModule,
    AppAvatarComponent,
    BrnSeparatorComponent,
    HlmSeparatorDirective,
    ToUserPipe,
    DisplayNamePipe,
    HlmAlertModule,
    HlmButtonDirective,
    HlmLabelDirective,
    NzToolTipModule,
    ToDatePipe,
    DatePipe,
    HlmSkeletonComponent,
  ],
  hostDirectives: [
    HlmCardDirective
  ],
  host: {
    'class': '@container'
  },
  providers: [
    ...provideIcons({
      lucidePhoneCall,
      lucidePhone,
    }),
  ],
})
export class EmergencyCardComponent {
  private readonly callService = inject(CALL_SERVICE);
  private readonly emergencyService = inject(EmergencyTargetService);

  protected readonly layout = inject(LayoutService)
  protected readonly profiles = injectUserProfiles();

  protected readonly inboundNumbers = signal<InboundNumber[]>([]);
  protected readonly onCall = signal<OnCallResponse[]>([]);
  protected readonly tick = signal<number>(new Date().getTime());
  protected readonly loading = signal(true);

  protected readonly _computedAvatarSize = computed<AvatarVariants['variant']>(() => {
    const lg = this.layout.lg();

    if (lg) {
      return 'large'
    }

    return 'medium'
  })

  constructor() {
    this.callService
      .listInboundNumber({})
      .catch(err => {
        toast.error('Failed to load inbound numbers', {
          description: ConnectError.from(err).message,
        });

        return new ListInboundNumberResponse();
      })
      .then(response => this.inboundNumbers.set(response.inboundNumbers));

    // Trigger a reload if the emergecy service reloaded
    effect(
      () => {
        this.emergencyService.shouldUpdate();

        console.log("on-call-change event occured, reloading on-call")
        this.tick.set(new Date().getTime());
      },
      { allowSignalWrites: true }
    );

    effect(() => {
      this.tick();
      const numbers = this.inboundNumbers();

      Promise.all(
        numbers.map(n =>
          this.callService
            .getOnCall({ inboundNumber: n.number })
            .catch(err => {
              toast.error(
                'Failed to get on call for inbound number: ' + n.number,
                {
                  description: ConnectError.from(err).message,
                }
              );

              return new GetOnCallResponse();
            })
            .then(response => new OnCallResponse(response, n))
        )
      ).then(responses => {
        this.onCall.set(responses);

        setTimeout(() => this.loading.set(false), 500)
      });
    });
  }

  get canSetOverwrite(): boolean {
    return true;
  }
}
