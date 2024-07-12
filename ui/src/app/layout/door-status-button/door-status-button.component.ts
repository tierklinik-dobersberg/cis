import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { lucideDoorClosed, lucideDoorOpen } from "@ng-icons/lucide";
import { BrnMenuModule } from "@spartan-ng/ui-menu-brain";
import { BrnSheetModule } from "@spartan-ng/ui-sheet-brain";
import { BrnTooltipModule } from "@spartan-ng/ui-tooltip-brain";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { HlmIconModule, provideIcons } from "@tierklinik-dobersberg/angular/icon";
import { LayoutService } from "@tierklinik-dobersberg/angular/layout";
import { HlmMenuModule } from "@tierklinik-dobersberg/angular/menu";
import { HlmSheetModule } from "@tierklinik-dobersberg/angular/sheet";
import { HlmTooltipModule } from "@tierklinik-dobersberg/angular/tooltip";
import { toast } from 'ngx-sonner';
import { BehaviorSubject, combineLatest, finalize, interval, mergeMap, retry, startWith } from "rxjs";
import { DoorAPI } from "src/app/api";
import { AppMenuComponent } from "src/app/components/app-menu";
import { AppSheetTriggerDirective } from "src/app/components/sheet-trigger";
import { extractErrorMessage } from "src/app/utils";

@Component({
    selector: 'app-door-status-button',
    standalone: true,
    templateUrl: './door-status-button.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        HlmMenuModule,
        BrnMenuModule,
        HlmButtonDirective,
        HlmIconModule,
        HlmTooltipModule,
        BrnTooltipModule,
        BrnSheetModule,
        HlmSheetModule,
        AppSheetTriggerDirective,
        AppMenuComponent,
        NgTemplateOutlet
    ],
    providers: [
        ...provideIcons({
            lucideDoorClosed,
            lucideDoorOpen,
        })
    ]
})
export class AppDoorStatusButtonComponent {
    private readonly doorApi = inject(DoorAPI);
    
    private readonly triggerReload$ = new BehaviorSubject<void>(undefined);
    
    protected readonly layout = inject(LayoutService);
    protected readonly doorState = toSignal(
        combineLatest([
            interval(10000),
            this.triggerReload$,
        ]).pipe(
            startWith(0),
            mergeMap(() => this.doorApi.state()),
            retry({delay: 10000})
        )
    )
    
    protected _computedBtnClass = computed(() => {
        if (this._computedIsLocked()) {
            return 'text-yellow-500'
        }
        
        return 'text-green-500'
    });

    protected _computedIsLocked = computed(() => this.doorState()?.state === 'locked');
    protected _computedUntil = computed(() => {
        const state = this.doorState();
        const now = new Date();
   
        if (now.toDateString() !== state.until.toDateString()) {
            const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
            return days[state.until.getDay()] + ' ' + state.until.toLocaleTimeString();
        }
        
        return state.until.toLocaleTimeString();
    });

    protected toggle(duration: string) {
        const state = this._computedIsLocked() ? 'unlock' : 'lock';
        this.doorApi
            .overwrite(state, duration)
            .pipe(finalize(() => this.triggerReload$.next()))
            .subscribe({
                error: err => {
                    toast.error('Türsteuerung fehlgeschlagen: ', {
                        description: extractErrorMessage(err)
                    })
                }
            })
    }
}