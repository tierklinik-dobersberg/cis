import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { BrnSelectService } from "@spartan-ng/ui-select-brain";
import { injectUserProfiles } from "@tierklinik-dobersberg/angular/behaviors";
import { DisplayNamePipe, ToUserPipe } from "@tierklinik-dobersberg/angular/pipes";

@Component({
    selector: 'app-select-user-value',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        @for(val of _computedValue(); track val; let last=$last) {
            {{ val | toUser:profiles() | displayName}}
            @if (!last) {
                <span class="mr-1">,</span>
            }
        }
    `,
    imports: [
        ToUserPipe,
        DisplayNamePipe
    ],
})
export class SelectUserValueComponent {
    private _selectService = inject(BrnSelectService);
    
    protected profiles = injectUserProfiles();
    protected _computedValue = computed(() => {
        const value = this._selectService.value();

        if (this._selectService.multiple()) {
            return value as string[];
        }
        
        return [value] as string[];
    })
}