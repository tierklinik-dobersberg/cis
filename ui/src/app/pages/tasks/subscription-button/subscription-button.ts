import { KeyValuePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { Empty, PartialMessage } from "@bufbuild/protobuf";
import { ConnectError } from "@connectrpc/connect";
import { lucideBell, lucideBellOff } from "@ng-icons/lucide";
import { BrnCommandModule } from "@spartan-ng/ui-command-brain";
import { BrnPopoverModule } from "@spartan-ng/ui-popover-brain";
import { injectCurrentProfile } from "@tierklinik-dobersberg/angular/behaviors";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { HlmCommandModule } from "@tierklinik-dobersberg/angular/command";
import { HlmIconModule, provideIcons } from "@tierklinik-dobersberg/angular/icon";
import { HlmPopoverModule } from "@tierklinik-dobersberg/angular/popover";
import { ManageSubscriptionRequest, NotificationType, Subscription } from "@tierklinik-dobersberg/apis/tasks/v1";
import { toast } from "ngx-sonner";

interface SubscriptionManager {
    manageSubscription(req: PartialMessage<ManageSubscriptionRequest>): Promise<Empty>;
}

@Component({
    selector: 'app-subscription-button',
    standalone: true,
    templateUrl: './subscription-button.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        HlmButtonDirective,
        HlmIconModule,
        BrnPopoverModule,
        HlmPopoverModule,
        BrnCommandModule,
        HlmCommandModule,
        KeyValuePipe
    ],
    providers: [
        ...provideIcons({lucideBell, lucideBellOff})
    ]
})
export class SubscriptionButton {
    public readonly id = input.required<string>();
    public readonly subscription = input.required<{[userId: string]: Subscription}>();
    public readonly service = input.required<SubscriptionManager>();

    protected readonly currentUser = injectCurrentProfile();

    protected readonly computedSubscription = computed(() => {
        const user = this.currentUser();
        const subscription = this.subscription();

        const sub = subscription[user.user.id] || null

        return sub;
    })

    protected readonly computedIsSubscriped = computed(() => {
        const sub = this.computedSubscription();
        if (!sub || sub.unsubscribed) {
            return false
        }

        return true
    })

    protected values = {
        [NotificationType.MAIL]: 'E-Mail',
        [NotificationType.SMS]: 'SMS',
        [NotificationType.WEBPUSH]: 'Push-Benachrichtigungen',
    }

    protected readonly computedIcon = computed(() => {
        return this.computedIsSubscriped() ? 'lucideBell' : 'lucideBellOff'
    })

    protected readonly computedText = computed(() => {
        return this.computedIsSubscriped() ? 'Benachrichtigungen: An' : 'Benachrichtigungen: Aus'
    })

    protected setSubscription(type: number | string) {
        if (typeof type === 'string') {
            type = +type
        }

        const types = this.computedSubscription()?.notificationTypes || [];
        
        let req: PartialMessage<ManageSubscriptionRequest> = {
            id: this.id(),
            userId: this.currentUser().user.id,
        }

        if (type === -1) {
            req.unsubscribe = true
        }
        else {
            const has = types.includes(type)
            if (has) {
                req.types = types.filter(t => t != type)
            } else {
                req.types = [
                    ...types, 
                    type
                ]
            }
        }

        this.service()
            .manageSubscription(req)
            .catch(err => {
                toast.error('Benachrichtiungs-Einstellungen konnten nicht gespeicher werden', {
                    description: ConnectError.from(err).message
                })
            })
    }
}